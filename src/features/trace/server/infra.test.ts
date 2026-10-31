// @vitest-environment node
import { createTraceCache } from "./cache";
import { toNdjsonStream } from "./ndjson";
import { createRateLimiter } from "./rate-limit";
import type { TraceEvent } from "./run-trace";

describe("createRateLimiter", () => {
  it("allows 10 requests per window per key", () => {
    let now = 0;
    const limiter = createRateLimiter({
      limit: 10,
      windowMs: 60_000,
      now: () => now,
    });

    for (let i = 0; i < 10; i++) expect(limiter.take("ip")).toBe(true);
    expect(limiter.take("ip")).toBe(false);
    expect(limiter.take("other")).toBe(true);

    now = 60_001;
    expect(limiter.take("ip")).toBe(true);
  });
});

describe("createTraceCache", () => {
  const events: TraceEvent[] = [{ type: "done", total: 0 }];

  it("returns entries until they expire", () => {
    let now = 0;
    const cache = createTraceCache({ max: 2, ttlMs: 1000, now: () => now });
    cache.set("a", events);

    now = 999;
    expect(cache.get("a")).toEqual(events);
    now = 1001;
    expect(cache.get("a")).toBeUndefined();
  });

  it("evicts the least recently used entry beyond its size", () => {
    const cache = createTraceCache({ max: 2, ttlMs: 1000, now: () => 0 });
    cache.set("a", events);
    cache.set("b", events);
    cache.get("a");
    cache.set("c", events);

    expect(cache.get("a")).toEqual(events);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toEqual(events);
  });
});

describe("toNdjsonStream", () => {
  it("writes one JSON line per event", async () => {
    async function* events() {
      yield { type: "started" };
      yield { type: "done", total: 0 };
    }

    const text = await new Response(toNdjsonStream(events())).text();

    expect(text).toBe('{"type":"started"}\n{"type":"done","total":0}\n');
  });

  it("stops the source when the reader cancels", async () => {
    let finished = false;
    async function* events() {
      try {
        yield { n: 1 };
        yield { n: 2 };
      } finally {
        finished = true;
      }
    }
    const reader = toNdjsonStream(events()).getReader();

    await reader.read();
    await reader.cancel();

    expect(finished).toBe(true);
  });
});
