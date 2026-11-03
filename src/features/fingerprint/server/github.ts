import { z } from "zod";

import {
  median,
  type Profile,
  summarizeTimestamps,
  topLanguages,
} from "../domain/profile";

const API = "https://api.github.com";
const TIMEOUT_MS = 8000;
const TARGET = /^[A-Za-z0-9-]{1,39}(\/[A-Za-z0-9._-]{1,100})?$/;

export type ProfileErrorCode = "not-found" | "rate-limited" | "unavailable";

const MESSAGES: Record<ProfileErrorCode, string> = {
  "not-found": "No public GitHub user or repository with that name.",
  "rate-limited":
    "GitHub's limit for anonymous requests is used up. Try again in a while, or set GITHUB_TOKEN.",
  unavailable: "GitHub didn't respond. Try again shortly.",
};

export class ProfileError extends Error {
  constructor(public readonly code: ProfileErrorCode) {
    super(MESSAGES[code]);
    this.name = "ProfileError";
  }
}

/** A GitHub user or owner/repo. Dot segments would walk up the API's URL, so they don't count. */
export function isValidTarget(target: string): boolean {
  if (!TARGET.test(target)) return false;
  const repo = target.split("/")[1];
  return repo !== "." && repo !== "..";
}

interface Deps {
  token?: string;
  fetch?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** Calls GitHub. A failed request is status 0; running out of quota always stops everything. */
async function call(
  path: string,
  deps: Deps,
): Promise<{ status: number; body: unknown }> {
  const timeout = AbortSignal.timeout(deps.timeoutMs ?? TIMEOUT_MS);
  try {
    const response = await (deps.fetch ?? fetch)(`${API}${path}`, {
      headers: {
        accept: "application/vnd.github+json",
        ...(deps.token ? { authorization: `Bearer ${deps.token}` } : {}),
      },
      signal: deps.signal ? AbortSignal.any([deps.signal, timeout]) : timeout,
    });
    const exhausted =
      response.status === 429 ||
      (response.status === 403 &&
        response.headers.get("x-ratelimit-remaining") === "0");
    if (exhausted) throw new ProfileError("rate-limited");
    if (!response.ok) return { status: response.status, body: null };
    return { status: response.status, body: await response.json() };
  } catch (error) {
    if (error instanceof ProfileError) throw error;
    return { status: 0, body: null };
  }
}

/** The first request decides whether the account exists at all. */
async function required(path: string, deps: Deps): Promise<unknown> {
  const { status, body } = await call(path, deps);
  if (status === 404) throw new ProfileError("not-found");
  if (status < 200 || status >= 300) throw new ProfileError("unavailable");
  return body;
}

/** Later requests only add detail: without them the poster is simply plainer. */
async function optional(path: string, deps: Deps): Promise<unknown> {
  return (await call(path, deps)).body;
}

/** The items of a list that match the schema. Anything else is dropped, never fatal. */
function items<T>(body: unknown, schema: z.ZodType<T>): T[] {
  if (!Array.isArray(body)) return [];
  return body.flatMap((item) => {
    const parsed = schema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

const userSchema = z.object({ login: z.string() });
const userRepoSchema = z.object({
  language: z.string().nullable().optional(),
  size: z.number(),
  stargazers_count: z.number(),
  fork: z.boolean(),
});
const eventSchema = z.object({ created_at: z.string() });

async function fetchUser(user: string, deps: Deps): Promise<Profile> {
  const account = userSchema.safeParse(await required(`/users/${user}`, deps));
  if (!account.success) throw new ProfileError("unavailable");

  const [repoBody, eventBody] = await Promise.all([
    optional(`/users/${user}/repos?per_page=100&sort=pushed`, deps),
    optional(`/users/${user}/events/public?per_page=100`, deps),
  ]);

  const repos = items(repoBody, userRepoSchema).filter((repo) => !repo.fork);
  const weights: Record<string, number> = {};
  for (const repo of repos) {
    if (repo.language) {
      weights[repo.language] = (weights[repo.language] ?? 0) + repo.size;
    }
  }

  return {
    kind: "user",
    name: account.data.login,
    languages: topLanguages(weights),
    ...summarizeTimestamps(
      items(eventBody, eventSchema).map((event) => event.created_at),
    ),
    sizes: {
      count: repos.length,
      median: median(repos.map((repo) => repo.size)),
    },
    stars: repos.reduce((sum, repo) => sum + repo.stargazers_count, 0),
  };
}

const repoSchema = z.object({
  full_name: z.string(),
  stargazers_count: z.number(),
  default_branch: z.string(),
});
const languagesSchema = z.record(z.string(), z.number());
const commitSchema = z.object({
  commit: z.object({ author: z.object({ date: z.string() }) }),
});
const treeSchema = z.object({ tree: z.array(z.unknown()) });
const blobSchema = z.object({ type: z.literal("blob"), size: z.number() });

async function fetchRepo(target: string, deps: Deps): Promise<Profile> {
  const repo = repoSchema.safeParse(await required(`/repos/${target}`, deps));
  if (!repo.success) throw new ProfileError("unavailable");
  const branch = encodeURIComponent(repo.data.default_branch);

  const [languageBody, commitBody, treeBody] = await Promise.all([
    optional(`/repos/${target}/languages`, deps),
    optional(`/repos/${target}/commits?per_page=100`, deps),
    optional(`/repos/${target}/git/trees/${branch}?recursive=1`, deps),
  ]);

  const languages = languagesSchema.safeParse(languageBody);
  const tree = treeSchema.safeParse(treeBody);
  const blobs = tree.success ? items(tree.data.tree, blobSchema) : [];

  return {
    kind: "repo",
    name: repo.data.full_name,
    languages: topLanguages(languages.success ? languages.data : {}),
    ...summarizeTimestamps(
      items(commitBody, commitSchema).map((item) => item.commit.author.date),
    ),
    sizes: {
      count: blobs.length,
      median: median(blobs.map((blob) => blob.size)),
    },
    stars: repo.data.stargazers_count,
  };
}

/**
 * Reads the public data behind a poster. `target` must already pass isValidTarget.
 * Throws ProfileError when the account can't be read at all or GitHub's quota is used up.
 */
export function fetchProfile(target: string, deps: Deps): Promise<Profile> {
  return target.includes("/")
    ? fetchRepo(target, deps)
    : fetchUser(target, deps);
}
