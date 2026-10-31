// @vitest-environment node
import {
  CREATE_USER,
  SUM_POSITIVE,
  SUM_POSITIVE_RENAMED,
} from "../domain/__fixtures__/pairs";
import { MIN_SIMILARITY } from "../domain/constants";
import type { SearchQuery } from "../domain/queries";
import {
  ProviderError,
  type SearchHit,
  type SearchProvider,
} from "../providers/types";
import {
  FETCH_CONCURRENCY,
  MAX_CANDIDATES,
  runTrace,
  type TraceDeps,
  type TraceEvent,
} from "./run-trace";

const hit = (path: string, repository = "acme/utils"): SearchHit => ({
  provider: "sourcegraph",
  repository,
  path,
  commit: "abc123",
  stars: 10,
});

function provider(
  overrides: Partial<SearchProvider> & {
    hits?: SearchHit[];
    seen?: SearchQuery[];
  } = {},
): SearchProvider {
  const { hits = [], seen = [], ...rest } = overrides;
  return {
    name: "sourcegraph",
    supportsRegex: true,
    search: async (query) => {
      seen.push(query);
      return hits;
    },
    ...rest,
  };
}

const CONTENT: Record<string, string> = {
  "match.js": SUM_POSITIVE_RENAMED,
  "other.js": CREATE_USER,
};
const fetchContent: TraceDeps["fetchContent"] = async (h) =>
  CONTENT[h.path] ?? null;

async function collect(
  events: AsyncGenerator<TraceEvent>,
): Promise<TraceEvent[]> {
  const all: TraceEvent[] = [];
  for await (const event of events) all.push(event);
  return all;
}

const run = (
  deps: TraceDeps,
  code = SUM_POSITIVE,
  signal = new AbortController().signal,
) => collect(runTrace({ code }, deps, signal));

describe("runTrace", () => {
  it("refuses snippets that are too short", async () => {
    expect(
      await run({ providers: [provider()], fetchContent }, "let a = 1;"),
    ).toEqual([
      {
        type: "error",
        code: "too-short",
        message:
          "This snippet is too short to trace. Paste a few lines, at least 20 tokens.",
      },
    ]);
  });

  it("streams started, results above the threshold, provider status and done", async () => {
    const events = await run({
      providers: [provider({ hits: [hit("match.js"), hit("other.js")] })],
      fetchContent,
    });

    expect(events[0]).toMatchObject({
      type: "started",
      language: "javascript",
    });
    expect(events.at(-1)).toEqual({ type: "done", total: 1 });
    const results = events.flatMap((e) =>
      e.type === "result" ? [e.result] : [],
    );
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: "acme/utils/match.js",
      repository: "acme/utils",
      path: "match.js",
      stars: 10,
      similarity: 1,
      vendored: false,
      copies: 0,
      url: "https://github.com/acme/utils/blob/abc123/match.js#L1-L9",
    });
    expect(results[0]!.similarity).toBeGreaterThanOrEqual(MIN_SIMILARITY);
    expect(results[0]!.renames).toContainEqual({ from: "acc", to: "total" });
    expect(results[0]!.excerpt).toEqual({
      startLine: 1,
      lines: SUM_POSITIVE_RENAMED.split("\n"),
    });
    expect(events).toContainEqual({
      type: "provider",
      provider: "sourcegraph",
      status: "ok",
    });
  });

  it("sends regex queries only to providers that support them", async () => {
    const literalSeen: SearchQuery[] = [];
    const regexSeen: SearchQuery[] = [];
    await run({
      providers: [
        provider({ seen: regexSeen }),
        provider({ name: "github", supportsRegex: false, seen: literalSeen }),
      ],
      fetchContent,
    });

    expect(regexSeen.some((q) => q.regex)).toBe(true);
    expect(literalSeen.length).toBeGreaterThan(0);
    expect(literalSeen.every((q) => !q.regex)).toBe(true);
  });

  it("fetches each file once even when several queries or providers find it", async () => {
    const fetched: string[] = [];
    await run({
      providers: [
        provider({ hits: [hit("match.js")] }),
        provider({ name: "github", hits: [hit("match.js")] }),
      ],
      fetchContent: async (h) => {
        fetched.push(h.path);
        return CONTENT[h.path] ?? null;
      },
    });

    expect(fetched).toEqual(["match.js"]);
  });

  it(`fetches at most ${MAX_CANDIDATES} files, ${FETCH_CONCURRENCY} at a time`, async () => {
    let inFlight = 0;
    let peak = 0;
    let total = 0;
    const many = Array.from({ length: 30 }, (_, i) => hit(`file${i}.js`));

    await run({
      providers: [provider({ hits: many })],
      fetchContent: async () => {
        total++;
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight--;
        return null;
      },
    });

    expect(total).toBe(MAX_CANDIDATES);
    expect(peak).toBeLessThanOrEqual(FETCH_CONCURRENCY);
    expect(peak).toBeGreaterThan(1);
  });

  it("keeps going when one provider is rate limited", async () => {
    const events = await run({
      providers: [
        provider({
          name: "github",
          search: async () => {
            throw new ProviderError("rate-limited", "slow down");
          },
        }),
        provider({ hits: [hit("match.js")] }),
      ],
      fetchContent,
    });

    expect(events).toContainEqual({
      type: "provider",
      provider: "github",
      status: "rate-limited",
    });
    expect(events.filter((e) => e.type === "result")).toHaveLength(1);
    expect(events.at(-1)).toEqual({ type: "done", total: 1 });
  });

  it("cuts off a provider that never answers", async () => {
    const events = await run({
      providers: [
        provider({ search: () => new Promise<SearchHit[]>(() => {}) }),
      ],
      fetchContent,
      timeoutMs: 50,
    });

    expect(events).toContainEqual({
      type: "provider",
      provider: "sourcegraph",
      status: "timeout",
    });
    expect(events.at(-1)).toEqual({ type: "done", total: 0 });
  });

  it("reports a provider as partial when only some of its queries fail", async () => {
    const events = await run({
      providers: [
        provider({
          search: async (query) => {
            if (query.regex) throw new ProviderError("timeout", "slow");
            return [hit("match.js")];
          },
        }),
      ],
      fetchContent,
    });

    expect(events).toContainEqual({
      type: "provider",
      provider: "sourcegraph",
      status: "partial",
    });
    expect(events.filter((e) => e.type === "result")).toHaveLength(1);
  });

  it("starts no new downloads once the caller aborts", async () => {
    const controller = new AbortController();
    let started = 0;
    const many = Array.from({ length: 20 }, (_, i) => hit(`file${i}.js`));
    const trace = runTrace(
      { code: SUM_POSITIVE },
      {
        providers: [provider({ hits: many })],
        fetchContent: (_, { signal }) => {
          started++;
          return new Promise((resolve) => {
            signal.addEventListener("abort", () => resolve(null));
            setTimeout(() => resolve(null), 200);
          });
        },
      },
      controller.signal,
    );

    await trace.next(); // started
    await new Promise((resolve) => setTimeout(resolve, 20));
    controller.abort();
    await trace.next();
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(started).toBeLessThanOrEqual(FETCH_CONCURRENCY);
  });

  it("starts no new downloads when aborted mid-flight", async () => {
    const controller = new AbortController();
    let started = 0;
    const many = Array.from({ length: 20 }, (_, i) => hit(`file${i}.js`));
    const trace = runTrace(
      { code: SUM_POSITIVE },
      {
        providers: [provider({ hits: many })],
        fetchContent: (_, { signal }) => {
          started++;
          return new Promise((resolve) => {
            signal.addEventListener("abort", () => resolve(null));
            setTimeout(() => resolve(null), 200);
          });
        },
      },
      controller.signal,
    );

    await trace.next(); // started
    const pending = trace.next(); // downloads begin
    await new Promise((resolve) => setTimeout(resolve, 30));
    controller.abort();
    await pending;
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(started).toBe(FETCH_CONCURRENCY);
  });

  it("still finishes when scoring a candidate fails", async () => {
    const events = await run({
      providers: [provider({ hits: [hit("broken.js"), hit("match.js")] })],
      // Content that blows up when read makes scoring throw.
      fetchContent: async (h) =>
        h.path === "broken.js"
          ? ({
              get length(): number {
                throw new Error("unreadable");
              },
            } as unknown as string)
          : CONTENT[h.path]!,
    });

    expect(events.at(-1)).toEqual({ type: "done", total: 1 });
  });

  it("keeps the partial hits of a provider that answers when cut off", async () => {
    const events = await run({
      providers: [
        provider({
          search: (_, { signal }) =>
            new Promise<SearchHit[]>((resolve) =>
              // Like a real stream reader, it settles a moment after the abort.
              signal.addEventListener("abort", () =>
                setTimeout(() => resolve([hit("match.js")]), 20),
              ),
            ),
        }),
      ],
      fetchContent,
      timeoutMs: 50,
    });

    expect(events.filter((e) => e.type === "result")).toHaveLength(1);
    expect(events.at(-1)).toEqual({ type: "done", total: 1 });
  });

  it("stops and cancels provider work when the caller aborts", async () => {
    const controller = new AbortController();
    const seenSignals: AbortSignal[] = [];
    const trace = runTrace(
      { code: SUM_POSITIVE },
      {
        providers: [
          provider({
            search: (_, { signal }) => {
              seenSignals.push(signal);
              return new Promise<SearchHit[]>(() => {});
            },
          }),
        ],
        fetchContent,
      },
      controller.signal,
    );

    expect((await trace.next()).value).toMatchObject({ type: "started" });
    const pending = trace.next();
    controller.abort();

    expect(await pending).toEqual({ done: true, value: undefined });
    expect(seenSignals.length).toBeGreaterThan(0);
    expect(seenSignals.every((s) => s.aborted)).toBe(true);
  });

  it("detects the language when none is given and honours an explicit one", async () => {
    const detected = await run({ providers: [], fetchContent });
    const explicit = await collect(
      runTrace(
        { code: SUM_POSITIVE, language: "typescript" },
        { providers: [], fetchContent },
        new AbortController().signal,
      ),
    );

    expect(detected[0]).toMatchObject({
      type: "started",
      language: "javascript",
    });
    expect(explicit[0]).toMatchObject({
      type: "started",
      language: "typescript",
    });
  });
});
