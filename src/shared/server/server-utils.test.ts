// @vitest-environment node
import { createCache } from "./cache";
import { createRateLimiter } from "./rate-limit";

type TraceEvent = { type: "done"; total: number };

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

describe("createCache", () => {
  const events: TraceEvent[] = [{ type: "done", total: 0 }];

  it("returns entries until they expire", () => {
    let now = 0;
    const cache = createCache<TraceEvent[]>({
      max: 2,
      ttlMs: 1000,
      now: () => now,
    });
    cache.set("a", events);

    now = 999;
    expect(cache.get("a")).toEqual(events);
    now = 1001;
    expect(cache.get("a")).toBeUndefined();
  });

  it("evicts the least recently used entry beyond its size", () => {
    const cache = createCache<TraceEvent[]>({
      max: 2,
      ttlMs: 1000,
      now: () => 0,
    });
    cache.set("a", events);
    cache.set("b", events);
    cache.get("a");
    cache.set("c", events);

    expect(cache.get("a")).toEqual(events);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toEqual(events);
  });
});
