import { K } from "./constants";
import type { NormalizedToken } from "./normalize";
import { winnow } from "./winnow";

/** 1-based, inclusive. */
export interface LineRange {
  start: number;
  end: number;
}

export interface MatchRegion {
  snippet: LineRange;
  candidate: LineRange;
}

export interface Rename {
  from: string;
  to: string;
}

export interface Comparison {
  /** Share of the snippet's distinct fingerprints found in the candidate, from 0 to 1. */
  similarity: number;
  regions: MatchRegion[];
  renames: Rename[];
}

/** A run of tokens that is equal after normalization: snippet[s..s+length) = candidate[c..c+length). */
interface Segment {
  s: number;
  c: number;
  length: number;
}

const EMPTY: Comparison = { similarity: 0, regions: [], renames: [] };

export function compare(
  snippet: NormalizedToken[],
  candidate: NormalizedToken[],
): Comparison {
  const snippetPrints = winnow(snippet);
  const distinct = new Set(snippetPrints.map((f) => f.hash));
  if (distinct.size === 0 || candidate.length === 0) return EMPTY;

  const index = new Map<number, number[]>();
  for (const { hash, position } of winnow(candidate)) {
    const positions = index.get(hash);
    if (positions) positions.push(position);
    else index.set(hash, [position]);
  }

  let matched = 0;
  for (const hash of distinct) if (index.has(hash)) matched++;
  if (matched === 0) return EMPTY;

  const segments = findSegments(snippet, candidate, snippetPrints, index);
  return {
    similarity: matched / distinct.size,
    regions: toRegions(segments, snippet, candidate),
    renames: findRenames(segments, snippet, candidate),
  };
}

/**
 * Pairs each matching snippet fingerprint with a candidate occurrence (preferring one that
 * continues the current alignment), then grows the pair into the longest equal token run.
 */
function findSegments(
  snippet: NormalizedToken[],
  candidate: NormalizedToken[],
  prints: { hash: number; position: number }[],
  index: Map<number, number[]>,
): Segment[] {
  const equal = (s: number, c: number) =>
    snippet[s]!.value === candidate[c]!.value;
  const segments: Segment[] = [];
  let last: Segment | undefined;

  for (const { hash, position: sp } of prints) {
    const positions = index.get(hash);
    if (!positions) continue;

    if (
      last &&
      sp >= last.s &&
      sp + K <= last.s + last.length &&
      positions.includes(sp - last.s + last.c)
    ) {
      continue; // already inside the current segment
    }
    const lastC = last ? last.c + last.length : -1;
    const cp =
      (last && positions.find((p) => p - sp === last!.c - last!.s)) ??
      positions.find((p) => p >= lastC) ??
      positions[0]!;

    let s = sp;
    let c = cp;
    while (s > 0 && c > 0 && equal(s - 1, c - 1)) {
      s--;
      c--;
    }
    let end = sp + K;
    let cEnd = cp + K;
    while (
      end < snippet.length &&
      cEnd < candidate.length &&
      equal(end, cEnd)
    ) {
      end++;
      cEnd++;
    }
    last = { s, c, length: end - s };
    segments.push(last);
  }
  return segments;
}

function toRegions(
  segments: Segment[],
  snippet: NormalizedToken[],
  candidate: NormalizedToken[],
): MatchRegion[] {
  const sorted = [...segments].sort((a, b) => a.s - b.s);
  const merged: { s: number; sEnd: number; c: number; cEnd: number }[] = [];
  for (const { s, c, length } of sorted) {
    const sEnd = s + length - 1;
    const cEnd = c + length - 1;
    const prev = merged.at(-1);
    if (prev && s <= prev.sEnd + 1 && c <= prev.cEnd + 1 && c >= prev.c) {
      prev.sEnd = Math.max(prev.sEnd, sEnd);
      prev.cEnd = Math.max(prev.cEnd, cEnd);
    } else {
      merged.push({ s, sEnd, c, cEnd });
    }
  }
  return merged.map(({ s, sEnd, c, cEnd }) => ({
    snippet: { start: snippet[s]!.token.line, end: snippet[sEnd]!.token.line },
    candidate: {
      start: candidate[c]!.token.line,
      end: candidate[cEnd]!.token.line,
    },
  }));
}

/** Aligned identifiers inside matching runs. Each name keeps its most frequent counterpart. */
function findRenames(
  segments: Segment[],
  snippet: NormalizedToken[],
  candidate: NormalizedToken[],
): Rename[] {
  const counts = new Map<string, Map<string, number>>();
  const seen = new Set<string>();
  for (const { s, c, length } of segments) {
    for (let i = 0; i < length; i++) {
      const from = snippet[s + i]!.token;
      const to = candidate[c + i]!.token;
      if (from.kind !== "identifier" || to.kind !== "identifier") continue;
      const key = `${s + i}:${c + i}`;
      if (seen.has(key)) continue; // overlapping segments must not double count
      seen.add(key);
      const targets = counts.get(from.text) ?? new Map<string, number>();
      targets.set(to.text, (targets.get(to.text) ?? 0) + 1);
      counts.set(from.text, targets);
    }
  }

  const renames: Rename[] = [];
  for (const [from, targets] of counts) {
    const [to] = [...targets].sort((a, b) => b[1] - a[1])[0]!;
    if (to !== from) renames.push({ from, to });
  }
  return renames;
}
