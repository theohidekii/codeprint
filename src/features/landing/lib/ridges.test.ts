import { buildRidges, PRINT_CORE } from "./ridges";

describe("buildRidges", () => {
  it("builds 12 recurving loop ridges plus 9 arches above and 9 below", () => {
    expect(buildRidges()).toHaveLength(30);
  });

  it("is deterministic, so server and client render the same print", () => {
    expect(buildRidges()).toEqual(buildRidges());
  });

  it("returns SVG path data made of absolute move and line commands", () => {
    for (const ridge of buildRidges()) {
      expect(ridge.d).toMatch(
        /^M-?\d+(\.\d)?,-?\d+(\.\d)?( L-?\d+(\.\d)?,-?\d+(\.\d)?)+$/,
      );
    }
  });

  it("wraps the innermost loop tightly around the core", () => {
    const [inner] = buildRidges();
    const xs = inner!.d.match(/-?\d+(\.\d)?(?=,)/g)!.map(Number);

    expect(Math.max(...xs)).toBeGreaterThan(PRINT_CORE.x);
    expect(Math.max(...xs)).toBeLessThan(PRINT_CORE.x + 12);
  });

  it("gives each ridge a stable id for text paths", () => {
    const ids = buildRidges().map((ridge) => ridge.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe("ridge-0");
  });
});
