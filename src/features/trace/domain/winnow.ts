import { K, WINDOW } from "./constants";
import type { NormalizedToken } from "./normalize";

export interface Fingerprint {
  hash: number;
  /** Index of the first token of the k-gram this hash covers. */
  position: number;
}

const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;

/** 32-bit FNV-1a over UTF-16 code units, returned as an unsigned integer. */
export function fnv1a(text: string): number {
  let hash = FNV_OFFSET;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/**
 * Winnowing (Schleimer, Wilkerson and Aiken, 2003): hash every k-gram of tokens and keep the
 * minimum hash of each window. Robust variant: on ties, keep the previous pick while it is still
 * in the window, otherwise take the rightmost minimum. Positions are never emitted twice.
 */
export function winnow(
  tokens: NormalizedToken[],
  options: { k?: number; window?: number } = {},
): Fingerprint[] {
  const k = options.k ?? K;
  const count = tokens.length - k + 1;
  if (count <= 0) return [];

  const hashes = Array.from({ length: count }, (_, i) =>
    fnv1a(
      tokens
        .slice(i, i + k)
        .map((t) => t.value)
        .join("\u0000"),
    ),
  );
  const window = Math.min(options.window ?? WINDOW, count);

  const fingerprints: Fingerprint[] = [];
  let picked = -1;
  for (let start = 0; start + window <= count; start++) {
    let min = Infinity;
    let rightmost = start;
    for (let i = start; i < start + window; i++) {
      if (hashes[i]! <= min) {
        min = hashes[i]!;
        rightmost = i;
      }
    }
    const keepPrevious = picked >= start && hashes[picked] === min;
    const position = keepPrevious ? picked : rightmost;
    if (position !== picked) {
      fingerprints.push({ hash: min, position });
      picked = position;
    }
  }
  return fingerprints;
}
