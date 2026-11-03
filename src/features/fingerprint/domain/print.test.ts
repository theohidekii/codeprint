import { buildPrint, PRINT_BOX } from "./print";
import type { PrintPattern, Traits } from "./traits";

const traits = (overrides: Partial<Traits> = {}): Traits => ({
  seed: "octocat",
  pattern: "loop",
  core: { x: 10, y: -8 },
  ridgeCount: 20,
  wobble: 1,
  bands: [
    { name: "TypeScript", share: 0.75 },
    { name: "Go", share: 0.25 },
  ],
  ring: Array<number>(24).fill(0),
  peakHour: null,
  quiet: false,
  ...overrides,
});

/** All [x, y] points of a path. */
const points = (d: string) =>
  d
    .slice(1)
    .split(" L")
    .map((pair) => pair.split(",").map(Number) as [number, number]);

const PATTERNS: PrintPattern[] = ["loop", "whorl", "arch"];

describe("buildPrint", () => {
  it.each(PATTERNS)("draws exactly ridgeCount %s ridges", (pattern) => {
    expect(buildPrint(traits({ pattern, ridgeCount: 27 }))).toHaveLength(27);
  });

  it.each(PATTERNS)("is deterministic for %s", (pattern) => {
    expect(buildPrint(traits({ pattern }))).toEqual(
      buildPrint(traits({ pattern })),
    );
  });

  it("draws different geometry for each pattern", () => {
    const paths = PATTERNS.map((pattern) =>
      buildPrint(traits({ pattern }))
        .map((r) => r.d)
        .join(),
    );

    expect(new Set(paths).size).toBe(3);
  });

  it("draws different geometry for different seeds", () => {
    expect(buildPrint(traits({ seed: "a" }))).not.toEqual(
      buildPrint(traits({ seed: "b" })),
    );
  });

  it.each(PATTERNS)("writes valid paths inside the box for %s", (pattern) => {
    for (const ridge of buildPrint(
      traits({ pattern, wobble: 5, ridgeCount: 34 }),
    )) {
      expect(ridge.d).toMatch(
        /^M-?\d+(\.\d)?,-?\d+(\.\d)?( L-?\d+(\.\d)?,-?\d+(\.\d)?)+$/,
      );
      for (const [x, y] of points(ridge.d)) {
        expect(Math.abs(x)).toBeLessThanOrEqual(PRINT_BOX.x);
        expect(Math.abs(y)).toBeLessThanOrEqual(PRINT_BOX.y);
      }
    }
  });

  it.each(PATTERNS)(
    "draws %s ridges as smooth lines, with no jumps",
    (pattern) => {
      for (const ridge of buildPrint(
        traits({ pattern, wobble: 5, ridgeCount: 34 }),
      )) {
        const line = points(ridge.d);
        for (let i = 1; i < line.length; i++) {
          const step = Math.hypot(
            line[i]![0] - line[i - 1]![0],
            line[i]![1] - line[i - 1]![1],
          );
          expect(step, `${ridge.id} at point ${i}`).toBeLessThan(20);
        }
      }
    },
  );

  it.each(PATTERNS)("never lets wobble tear a %s ridge", (pattern) => {
    const steps = (d: string) => {
      const line = points(d);
      return line
        .slice(1)
        .map((p, i) => Math.hypot(p[0] - line[i]![0], p[1] - line[i]![1]));
    };

    for (const seed of ["a", "b", "c", "d", "e", "f"]) {
      const calm = buildPrint(
        traits({
          pattern,
          seed,
          wobble: 0,
          core: { x: 0, y: 0 },
          ridgeCount: 16,
        }),
      );
      const wild = buildPrint(
        traits({
          pattern,
          seed,
          wobble: 5,
          core: { x: 0, y: 0 },
          ridgeCount: 16,
        }),
      );
      calm.forEach((ridge, r) => {
        const base = steps(ridge.d);
        steps(wild[r]!.d).forEach((step, i) => {
          expect(step - base[i]!, `${seed} ${ridge.id} step ${i}`).toBeLessThan(
            8,
          );
        });
      });
    }
  });

  it("opens whorl rings at scattered angles, so they never form a wedge", () => {
    const openings = buildPrint(traits({ pattern: "whorl", wobble: 0 })).map(
      (ridge) => {
        const [x, y] = points(ridge.d)[0]!;
        return Math.atan2(y - -8, x - 10);
      },
    );
    const sectors = new Set(
      openings.map((angle) =>
        Math.floor(((angle + Math.PI) / (2 * Math.PI)) * 8),
      ),
    );

    expect(sectors.size).toBeGreaterThanOrEqual(6);
  });

  it("keeps whorl rings almost closed", () => {
    const [ring] = buildPrint(traits({ pattern: "whorl", wobble: 0 })).slice(
      -1,
    );
    const line = points(ring!.d);
    const [x0, y0] = line[0]!;
    const [x1, y1] = line.at(-1)!;
    const reach = Math.hypot(x0 - 10, y0 - -8);

    // The opening is a small arc of the ring, not a slice of it.
    expect(Math.hypot(x1 - x0, y1 - y0)).toBeLessThan(reach * 0.4);
  });

  it("gives each language its share of the ridges", () => {
    const ridges = buildPrint(traits());
    const count = (band: number) =>
      ridges.filter((r) => r.band === band).length;

    expect(count(0)).toBe(15);
    expect(count(1)).toBe(5);
  });

  it("gives every band at least one ridge", () => {
    const ridges = buildPrint(
      traits({
        ridgeCount: 14,
        bands: [
          { name: "A", share: 0.97 },
          { name: "B", share: 0.02 },
          { name: "C", share: 0.01 },
        ],
      }),
    );

    expect(new Set(ridges.map((r) => r.band))).toEqual(new Set([0, 1, 2]));
    expect(ridges).toHaveLength(14);
  });

  it("marks ridges with no language", () => {
    expect(buildPrint(traits({ bands: [] })).every((r) => r.band === -1)).toBe(
      true,
    );
  });

  it.each(PATTERNS)(
    "makes %s ridges more restless as wobble grows",
    (pattern) => {
      const drift = (wobble: number) => {
        const base = buildPrint(traits({ pattern, wobble: 0 }));
        const moved = buildPrint(traits({ pattern, wobble }));
        let total = 0;
        let n = 0;
        base.forEach((ridge, i) => {
          const others = points(moved[i]!.d);
          points(ridge.d).forEach(([x, y], j) => {
            total += Math.hypot(x - others[j]![0], y - others[j]![1]);
            n++;
          });
        });
        return total / n;
      };

      expect(drift(5)).toBeGreaterThan(drift(0.4) * 3);
    },
  );
});
