import { compare } from "../domain/compare";
import { MIN_SIMILARITY, MIN_TOKENS } from "../domain/constants";
import { normalize, type NormalizedToken } from "../domain/normalize";
import { buildQueries } from "../domain/queries";
import { isVendoredPath } from "../domain/rank";
import { detectLanguage, tokenize } from "../domain/tokenize";
import type { Language, TraceResult } from "../domain/types";
import { fnv1a } from "../domain/winnow";
import {
  ProviderError,
  type ProviderName,
  type ProviderStatus,
  type SearchHit,
  type SearchProvider,
  toProviderError,
} from "../providers/types";

export const MAX_CANDIDATES = 20;
export const FETCH_CONCURRENCY = 5;
export const PROVIDER_TIMEOUT_MS = 8000;
const EXCERPT_CONTEXT = 2;
const EXCERPT_MAX_LINES = 40;

export const TOO_SHORT_MESSAGE =
  "This snippet is too short to trace. Paste a few lines, at least 20 tokens.";

export type TraceEvent =
  | { type: "started"; language: Language; queries: number }
  | { type: "result"; result: TraceResult }
  | { type: "provider"; provider: ProviderName; status: ProviderStatus }
  | { type: "done"; total: number }
  | { type: "error"; code: "too-short"; message: string };

export interface TraceDeps {
  providers: SearchProvider[];
  fetchContent: (
    hit: SearchHit,
    options: { signal: AbortSignal },
  ) => Promise<string | null>;
  /** Per request. Defaults to PROVIDER_TIMEOUT_MS. */
  timeoutMs?: number;
}

/** How long a task may take to hand back partial results after being asked to stop. */
const GRACE_MS = 250;

/**
 * Runs `task` with its own abort signal. After `ms` the signal aborts, and the task gets
 * GRACE_MS to return what it already has (a search may have streamed some hits) before it is
 * cut off. Aborting `parent` cuts it off at once.
 */
async function withTimeout<T>(
  parent: AbortSignal,
  ms: number,
  task: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (parent.aborted) throw new ProviderError("timeout", "request aborted");
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let grace: ReturnType<typeof setTimeout> | undefined;
  let onParentAbort: (() => void) | undefined;
  try {
    return await Promise.race([
      task(controller.signal),
      new Promise<never>((_, reject) => {
        onParentAbort = () => {
          controller.abort();
          reject(new ProviderError("timeout", "request aborted"));
        };
        parent.addEventListener("abort", onParentAbort);
        timer = setTimeout(() => {
          controller.abort();
          grace = setTimeout(
            () => reject(new ProviderError("timeout", "request timed out")),
            GRACE_MS,
          );
        }, ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    clearTimeout(grace);
    if (onParentAbort) parent.removeEventListener("abort", onParentAbort);
  }
}

/** A tiny async queue: producers push events, the generator pulls them in order. */
function createChannel<T>() {
  const items: T[] = [];
  let wake: (() => void) | undefined;
  let closed = false;
  const notify = () => {
    wake?.();
    wake = undefined;
  };
  return {
    push(item: T) {
      if (closed) return;
      items.push(item);
      notify();
    },
    close() {
      closed = true;
      notify();
    },
    async *drain(): AsyncGenerator<T> {
      while (true) {
        while (items.length > 0) yield items.shift()!;
        if (closed) return;
        await new Promise<void>((resolve) => (wake = resolve));
      }
    },
  };
}

function toResult(
  hit: SearchHit,
  content: string,
  snippet: NormalizedToken[],
  language: Language,
): TraceResult | null {
  const candidate = normalize(tokenize(content, language));
  const { similarity, regions, renames } = compare(snippet, candidate);
  if (similarity < MIN_SIMILARITY) return null;

  const first = regions[0];
  const lines = content.split("\n");
  const start = Math.max(1, (first?.candidate.start ?? 1) - EXCERPT_CONTEXT);
  const end = Math.min(
    lines.length,
    (first?.candidate.end ?? 1) + EXCERPT_CONTEXT,
    start + EXCERPT_MAX_LINES - 1,
  );
  const anchor = first
    ? `#L${first.candidate.start}-L${first.candidate.end}`
    : "";

  return {
    id: `${hit.repository}/${hit.path}`,
    repository: hit.repository,
    path: hit.path,
    url: `https://github.com/${hit.repository}/blob/${hit.commit}/${hit.path}${anchor}`,
    stars: hit.stars,
    similarity,
    regions,
    renames,
    excerpt: { startLine: start, lines: lines.slice(start - 1, end) },
    contentHash: fnv1a(candidate.map((t) => t.value).join("\u0000")),
    vendored: isVendoredPath(hit.path),
    copies: 0,
  };
}

/**
 * Traces a snippet: builds queries, asks every provider, fetches each distinct candidate file
 * once (bounded), scores it and streams events as they happen. Aborting `signal` stops all work.
 */
export async function* runTrace(
  input: { code: string; language?: Language },
  deps: TraceDeps,
  signal: AbortSignal,
): AsyncGenerator<TraceEvent> {
  const language = input.language ?? detectLanguage(input.code);
  const tokens = tokenize(input.code, language);
  const snippet = normalize(tokens);
  if (snippet.length < MIN_TOKENS) {
    yield { type: "error", code: "too-short", message: TOO_SHORT_MESSAGE };
    return;
  }

  const queries = buildQueries(input.code, tokens);
  yield { type: "started", language, queries: queries.length };

  const timeoutMs = deps.timeoutMs ?? PROVIDER_TIMEOUT_MS;
  const controller = new AbortController();
  const stop = () => controller.abort();
  // The caller may have aborted while we were paused at `started`.
  if (signal.aborted) stop();
  signal.addEventListener("abort", stop);

  const channel = createChannel<TraceEvent>();
  controller.signal.addEventListener("abort", () => channel.close());

  const seen = new Set<string>();
  const waiting: SearchHit[] = [];
  const fetches: Promise<void>[] = [];
  let active = 0;
  let total = 0;

  const pump = () => {
    // Once the trace is aborted, queued candidates are never downloaded.
    if (controller.signal.aborted) return;
    while (active < FETCH_CONCURRENCY && waiting.length > 0) {
      const hit = waiting.shift()!;
      active++;
      fetches.push(
        withTimeout(controller.signal, timeoutMs, (s) =>
          deps.fetchContent(hit, { signal: s }),
        )
          .catch(() => null)
          .then((content) => {
            const result = content && toResult(hit, content, snippet, language);
            if (result && !controller.signal.aborted) {
              total++;
              channel.push({ type: "result", result });
            }
          })
          // One unscorable file is skipped; it must not stop the trace from finishing.
          .catch(() => {})
          .finally(() => {
            active--;
            pump();
          }),
      );
    }
  };

  const enqueue = (hits: SearchHit[]) => {
    for (const hit of hits) {
      const key = `${hit.repository}/${hit.path}`;
      if (seen.has(key) || seen.size >= MAX_CANDIDATES) continue;
      seen.add(key);
      waiting.push(hit);
    }
    pump();
  };

  const searches = deps.providers.map(async (provider) => {
    let answered = 0;
    let failure: ProviderStatus | undefined;
    const usable = queries.filter((q) => provider.supportsRegex || !q.regex);
    await Promise.all(
      usable.map(async (query) => {
        try {
          enqueue(
            await withTimeout(controller.signal, timeoutMs, (s) =>
              provider.search(query, {
                language,
                limit: MAX_CANDIDATES,
                signal: s,
              }),
            ),
          );
          answered++;
        } catch (error) {
          failure ??= toProviderError(error, provider.name).status;
        }
      }),
    );
    const status: ProviderStatus = !failure
      ? "ok"
      : answered > 0
        ? "partial"
        : failure;
    if (!controller.signal.aborted) {
      channel.push({ type: "provider", provider: provider.name, status });
    }
  });

  void (async () => {
    await Promise.all(searches);
    // Fetches started by late hits are appended while earlier ones settle.
    for (let i = 0; i < fetches.length; i++) await fetches[i];
    channel.push({ type: "done", total });
    channel.close();
  })();

  try {
    yield* channel.drain();
  } finally {
    signal.removeEventListener("abort", stop);
    controller.abort();
  }
}
