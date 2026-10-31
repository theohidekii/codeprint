import { isVendoredPath, rank } from "./rank";
import type { TraceResult } from "./types";

let next = 0;
function result(overrides: Partial<TraceResult>): TraceResult {
  next++;
  return {
    id: `owner/repo${next}/src/file.js`,
    repository: `owner/repo${next}`,
    path: "src/file.js",
    url: `https://github.com/owner/repo${next}/blob/abc/src/file.js#L1-L5`,
    stars: 0,
    similarity: 0.9,
    regions: [],
    renames: [],
    excerpt: { startLine: 1, lines: [] },
    contentHash: next,
    vendored: false,
    copies: 0,
    ...overrides,
  };
}

describe("isVendoredPath", () => {
  it.each([
    "node_modules/x.js",
    "a/vendor/b.go",
    "dist/app.js",
    "lib/x.min.js",
  ])("flags %s", (path) => {
    expect(isVendoredPath(path)).toBe(true);
  });

  it.each(["src/vendors.ts", "src/distance.ts", "lib/admin.js"])(
    "does not flag %s",
    (path) => {
      expect(isVendoredPath(path)).toBe(false);
    },
  );
});

describe("rank", () => {
  it("drops results below the minimum similarity", () => {
    const kept = result({ similarity: 0.25 });

    expect(rank([result({ similarity: 0.24 }), kept])).toEqual([kept]);
  });

  it("orders by similarity, then stars, treating unknown stars as zero", () => {
    const a = result({ similarity: 0.8, stars: 10 });
    const b = result({ similarity: 0.95, stars: null });
    const c = result({ similarity: 0.8, stars: null });
    const d = result({ similarity: 0.8, stars: 500 });

    expect(rank([a, b, c, d]).map((r) => r.id)).toEqual([
      b.id,
      d.id,
      a.id,
      c.id,
    ]);
  });

  it("puts vendored copies below originals of equal similarity", () => {
    const vendored = result({ similarity: 0.9, stars: 9000, vendored: true });
    const original = result({ similarity: 0.9, stars: 3 });

    expect(rank([vendored, original]).map((r) => r.id)).toEqual([
      original.id,
      vendored.id,
    ]);
  });

  it("collapses identical content into the best representative and counts the copies", () => {
    const vendoredStar = result({
      contentHash: 42,
      stars: 9000,
      vendored: true,
    });
    const small = result({ contentHash: 42, stars: 2 });
    const popular = result({ contentHash: 42, stars: 300 });
    const other = result({ contentHash: 7, similarity: 0.5 });

    const ranked = rank([vendoredStar, small, popular, other]);

    expect(ranked).toHaveLength(2);
    expect(ranked[0]).toMatchObject({ id: popular.id, copies: 2 });
    expect(ranked[1]).toMatchObject({ id: other.id, copies: 0 });
  });

  it("does not mutate its input", () => {
    const input = [result({ similarity: 0.3 }), result({ similarity: 0.9 })];
    const snapshot = structuredClone(input);

    rank(input);

    expect(input).toEqual(snapshot);
  });
});
