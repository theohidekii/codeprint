import { z } from "zod";

import {
  isRateLimited,
  ProfileError,
} from "@/features/fingerprint/server/github";
import type { Language } from "@/features/trace/domain/types";

import {
  buildEdges,
  type Edge,
  type Hotspot,
  pickHotspots,
} from "../domain/edges";
import { extractImports, resolveImport } from "../domain/imports";
import { groupModules, type Module, type RepoFile } from "../domain/modules";

export type RoomModule = Omit<Module, "paths">;

export interface Analysis {
  repository: string;
  branch: string;
  files: number;
  truncated: boolean;
  modules: RoomModule[];
  edges: Edge[];
  hotspots: Hotspot[];
  /** Languages drawn as rooms whose dependencies aren't read. */
  unreadLanguages: string[];
  /** Dependencies come from a sample of the files. */
  sampled: boolean;
  topLanguage: string | null;
  /** Something failed or ran out of time: don't keep this result. */
  partial?: true;
}

interface Deps {
  token?: string;
  fetch?: typeof fetch;
  signal?: AbortSignal;
  budgetMs?: number;
}

const API = "https://api.github.com/repos";
const RAW = "https://raw.githubusercontent.com";
const MAX_FILES = 300;
const CONCURRENCY = 10;
const MAX_FILE_BYTES = 512 * 1024;
const REQUEST_MS = 8000;
const BUDGET_MS = 25_000;

const LANGUAGE_NAMES: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript",
  mjs: "JavaScript",
  cjs: "JavaScript",
  py: "Python",
  go: "Go",
  rs: "Rust",
  java: "Java",
  c: "C",
  h: "C",
  cpp: "C++",
  cc: "C++",
  hpp: "C++",
  cs: "C#",
  php: "PHP",
  rb: "Ruby",
  swift: "Swift",
  kt: "Kotlin",
};

const READABLE: Record<string, Language> = {
  ts: "typescript",
  tsx: "typescript",
  js: "typescript",
  jsx: "typescript",
  mjs: "typescript",
  cjs: "typescript",
  py: "python",
};

const extension = (path: string) => path.slice(path.lastIndexOf(".") + 1);

const repoSchema = z.object({
  full_name: z.string(),
  default_branch: z.string(),
});
const treeSchema = z.object({
  truncated: z.boolean().optional(),
  tree: z.array(z.unknown()),
});
const blobSchema = z.object({
  type: z.literal("blob"),
  path: z.string(),
  size: z.number(),
});

async function api(url: string, deps: Deps): Promise<Response | null> {
  const timeout = AbortSignal.timeout(REQUEST_MS);
  try {
    const response = await (deps.fetch ?? fetch)(url, {
      headers: {
        accept: "application/vnd.github+json",
        ...(deps.token ? { authorization: `Bearer ${deps.token}` } : {}),
      },
      signal: deps.signal ? AbortSignal.any([deps.signal, timeout]) : timeout,
    });
    if (isRateLimited(response)) throw new ProfileError("rate-limited");
    return response;
  } catch (error) {
    if (error instanceof ProfileError) throw error;
    return null;
  }
}

/** Takes files turn by turn from each module, largest first, so every room is represented. */
function pickFiles(
  modules: readonly Module[],
  sizes: Map<string, number>,
): string[] {
  const queues = modules.map((room) =>
    room.paths
      .filter((path) => extension(path) in READABLE)
      .filter((path) => (sizes.get(path) ?? 0) <= MAX_FILE_BYTES)
      .sort((a, b) => (sizes.get(b) ?? 0) - (sizes.get(a) ?? 0)),
  );
  const picked: string[] = [];
  for (let turn = 0; ; turn++) {
    let any = false;
    for (const queue of queues) {
      if (turn < queue.length) {
        picked.push(queue[turn]!);
        any = true;
      }
    }
    if (!any) return picked;
  }
}

function languageSummary(files: readonly RepoFile[]) {
  const bytes = new Map<string, number>();
  const unread = new Set<string>();
  for (const file of files) {
    const ext = extension(file.path);
    const name = LANGUAGE_NAMES[ext];
    if (!name) continue;
    bytes.set(name, (bytes.get(name) ?? 0) + file.size);
    if (!(ext in READABLE)) unread.add(name);
  }
  const top = [...bytes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { topLanguage: top, unreadLanguages: [...unread].sort() };
}

/** Reads a repository's structure and, for the languages it can parse, its dependencies. */
export async function analyzeRepository(
  target: string,
  deps: Deps,
): Promise<Analysis> {
  const repoResponse = await api(`${API}/${target}`, deps);
  if (repoResponse?.status === 404) throw new ProfileError("not-found");
  if (!repoResponse?.ok) throw new ProfileError("unavailable");
  const repo = repoSchema.safeParse(
    await repoResponse.json().catch(() => null),
  );
  if (!repo.success) throw new ProfileError("unavailable");
  const branch = repo.data.default_branch;
  const branchPath = encodeURIComponent(branch);

  let partial = false;
  const treeResponse = await api(
    `${API}/${target}/git/trees/${branchPath}?recursive=1`,
    deps,
  );
  if (
    !treeResponse ||
    (!treeResponse.ok && ![404, 409].includes(treeResponse.status))
  ) {
    partial = true;
  }
  const tree = treeSchema.safeParse(
    treeResponse?.ok ? await treeResponse.json().catch(() => null) : null,
  );
  const blobs = tree.success
    ? tree.data.tree.flatMap((item) => {
        const blob = blobSchema.safeParse(item);
        return blob.success ? [blob.data] : [];
      })
    : [];

  const modules = groupModules(blobs);
  const inModules = new Set(modules.flatMap((m) => m.paths));
  const sources = blobs.filter((blob) => inModules.has(blob.path));
  const sizes = new Map(sources.map((blob) => [blob.path, blob.size]));
  const candidates = pickFiles(modules, sizes);
  const queue = candidates.slice(0, MAX_FILES);

  const budget = AbortSignal.timeout(deps.budgetMs ?? BUDGET_MS);
  const signal = deps.signal ? AbortSignal.any([deps.signal, budget]) : budget;
  const imports: { path: string; targets: string[] }[] = [];

  const worker = async () => {
    while (queue.length > 0 && !signal.aborted) {
      const path = queue.shift()!;
      try {
        const encoded = path.split("/").map(encodeURIComponent).join("/");
        const response = await (deps.fetch ?? fetch)(
          `${RAW}/${target}/${branchPath}/${encoded}`,
          {
            signal: AbortSignal.any([signal, AbortSignal.timeout(REQUEST_MS)]),
          },
        );
        if (!response.ok) continue;
        const source = await response.text();
        if (source.length > MAX_FILE_BYTES || source.includes("\u0000"))
          continue;
        const specs = extractImports(source, READABLE[extension(path)]!);
        const targets = specs.flatMap((spec) => {
          const resolved = resolveImport(path, spec, inModules);
          return resolved ? [resolved] : [];
        });
        imports.push({ path, targets });
      } catch {
        if (!signal.aborted) partial = true;
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  if (deps.signal?.aborted) throw new ProfileError("unavailable");
  if (budget.aborted) partial = true;

  const edges = buildEdges(imports, modules);
  return {
    repository: repo.data.full_name,
    branch,
    files: sources.length,
    truncated: tree.success ? tree.data.truncated === true : false,
    modules: modules.map(({ id, name, bytes, files }) => ({
      id,
      name,
      bytes,
      files,
    })),
    edges,
    hotspots: pickHotspots(modules, edges),
    sampled: candidates.length > MAX_FILES,
    ...languageSummary(sources),
    ...(partial ? { partial: true as const } : {}),
  };
}
