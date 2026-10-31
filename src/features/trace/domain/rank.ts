import { MIN_SIMILARITY } from "./constants";
import type { TraceResult } from "./types";

const VENDORED = /(^|\/)(node_modules|vendor|dist)\/|\.min\./;

/** Bundled or vendored copies are rarely the original source. */
export function isVendoredPath(path: string): boolean {
  return VENDORED.test(path);
}

function byPreference(a: TraceResult, b: TraceResult): number {
  return (
    b.similarity - a.similarity ||
    Number(a.vendored) - Number(b.vendored) ||
    (b.stars ?? 0) - (a.stars ?? 0)
  );
}

/**
 * Drops weak matches, collapses identical copies into their most likely origin and orders the
 * rest: most similar first, originals before vendored copies, then by popularity.
 */
export function rank(results: readonly TraceResult[]): TraceResult[] {
  const groups = new Map<number, TraceResult[]>();
  for (const result of results) {
    if (result.similarity < MIN_SIMILARITY) continue;
    const group = groups.get(result.contentHash);
    if (group) group.push(result);
    else groups.set(result.contentHash, [result]);
  }

  return [...groups.values()]
    .map((group) => {
      const [best] = [...group].sort(
        (a, b) =>
          Number(a.vendored) - Number(b.vendored) ||
          (b.stars ?? 0) - (a.stars ?? 0),
      );
      return { ...best!, copies: group.length - 1 };
    })
    .sort(byPreference);
}
