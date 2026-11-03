import { fnv1a } from "@/features/trace/domain/winnow";

/**
 * A small seeded generator (mulberry32). Every "random" choice in a print comes from here, so the
 * same name always draws the same print.
 */
export function seededRandom(seed: string): () => number {
  let state = fnv1a(seed);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
