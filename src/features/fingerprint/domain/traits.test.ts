import type { Profile } from "./profile";
import { seededRandom } from "./random";
import { deriveTraits } from "./traits";

const profile = (overrides: Partial<Profile> = {}): Profile => ({
  kind: "user",
  name: "octocat",
  languages: [
    { name: "TypeScript", share: 0.75 },
    { name: "Go", share: 0.25 },
  ],
  hours: Array<number>(24)
    .fill(0)
    .map((_, i) => (i === 14 ? 10 : i === 3 ? 5 : 0)),
  weekdays: [2, 2, 2, 2, 2, 2, 2],
  sizes: { count: 50, median: 200 },
  stars: 100,
  sampled: 15,
  ...overrides,
});

describe("seededRandom", () => {
  it("repeats for a seed and differs between seeds", () => {
    const sequence = (seed: string) => {
      const next = seededRandom(seed);
      return Array.from({ length: 8 }, () => next());
    };

    expect(sequence("a")).toEqual(sequence("a"));
    expect(sequence("a")).not.toEqual(sequence("b"));
  });

  it("stays in [0, 1)", () => {
    const next = seededRandom("range");
    for (let i = 0; i < 2000; i++) {
      const value = next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("deriveTraits", () => {
  it("is deterministic and ignores letter case in the name", () => {
    expect(deriveTraits(profile())).toEqual(deriveTraits(profile()));
    expect(deriveTraits(profile({ name: "OctoCat" }))).toEqual(
      deriveTraits(profile({ name: "octocat" })),
    );
  });

  it("gives names all three patterns, with the core near the centre", () => {
    const traits = Array.from({ length: 200 }, (_, i) =>
      deriveTraits(profile({ name: `user-${i}` })),
    );

    expect(new Set(traits.map((t) => t.pattern))).toEqual(
      new Set(["loop", "whorl", "arch"]),
    );
    for (const { core } of traits) {
      expect(Math.abs(core.x)).toBeLessThanOrEqual(24);
      expect(Math.abs(core.y)).toBeLessThanOrEqual(24);
    }
  });

  it("scales the ridge count with size, on a log scale from 14 to 34", () => {
    const ridges = (count: number) =>
      deriveTraits(profile({ sizes: { count, median: 1 } })).ridgeCount;

    expect(ridges(0)).toBe(14);
    expect(ridges(100_000)).toBe(34);
    expect(ridges(5_000_000)).toBe(34);
    expect(ridges(1000)).toBeGreaterThan(ridges(10));
    expect(Number.isInteger(ridges(37))).toBe(true);
  });

  it("draws steady work calmly and bursty work restlessly", () => {
    const wobble = (weekdays: number[]) =>
      deriveTraits(profile({ weekdays })).wobble;
    const calm = wobble([5, 5, 5, 5, 5, 5, 5]);
    const bursty = wobble([35, 0, 0, 0, 0, 0, 0]);

    expect(calm).toBe(0.4);
    expect(bursty).toBeGreaterThan(calm);
    expect(bursty).toBeLessThanOrEqual(5);
    expect(wobble([0, 0, 0, 0, 0, 0, 0])).toBe(0.4);
  });

  it("normalizes the hour ring and finds the peak", () => {
    const { ring, peakHour } = deriveTraits(profile());

    expect(ring).toHaveLength(24);
    expect(ring[14]).toBe(1);
    expect(ring[3]).toBe(0.5);
    expect(peakHour).toBe(14);
  });

  it("copes with no activity", () => {
    const traits = deriveTraits(
      profile({
        languages: [],
        hours: Array<number>(24).fill(0),
        weekdays: Array<number>(7).fill(0),
        sampled: 0,
        sizes: { count: 0, median: 0 },
      }),
    );

    expect(traits.ring.every((value) => value === 0)).toBe(true);
    expect(traits.peakHour).toBeNull();
    expect(traits.bands).toEqual([]);
    expect(traits.quiet).toBe(true);
  });

  it("is not quiet when only one kind of data is present", () => {
    expect(deriveTraits(profile({ sampled: 0 })).quiet).toBe(false);
    expect(deriveTraits(profile({ languages: [] })).quiet).toBe(false);
  });
});
