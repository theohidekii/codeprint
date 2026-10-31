import type { NormalizedToken } from "./normalize";
import { fnv1a, winnow } from "./winnow";

function stream(values: string[]): NormalizedToken[] {
  return values.map((value, i) => ({
    value,
    token: { kind: "operator", text: value, line: 1, start: i, end: i + 1 },
  }));
}

/** Deterministic pseudo-random tokens from a small alphabet. */
function seeded(length: number, seed = 7): NormalizedToken[] {
  const alphabet = ["ID", "=", "(", ")", ";", "+", "NUM", "return", "{", "}"];
  let state = seed;
  return stream(
    Array.from({ length }, () => {
      state = (state * 1103515245 + 12345) % 2 ** 31;
      return alphabet[state % alphabet.length]!;
    }),
  );
}

describe("fnv1a", () => {
  it("matches the reference 32-bit FNV-1a values", () => {
    expect(fnv1a("")).toBe(2166136261);
    expect(fnv1a("a")).toBe(3826002220);
  });
});

describe("winnow", () => {
  it("returns nothing for fewer than k tokens", () => {
    expect(winnow(stream(["a", "b"]), { k: 3 })).toEqual([]);
  });

  it("returns one fingerprint for exactly k tokens", () => {
    expect(winnow(stream(["a", "b", "c"]), { k: 3, window: 4 })).toEqual([
      { hash: fnv1a("a\u0000b\u0000c"), position: 0 },
    ]);
  });

  it("selects a k-gram from every run of k + window - 1 tokens", () => {
    const k = 5;
    const window = 4;
    const tokens = seeded(200);
    const positions = new Set(
      winnow(tokens, { k, window }).map((f) => f.position),
    );

    for (let start = 0; start + k + window - 1 <= tokens.length; start++) {
      const covered = Array.from({ length: window }, (_, i) => start + i).some(
        (p) => positions.has(p),
      );
      expect(covered, `run starting at ${start}`).toBe(true);
    }
  });

  it("keeps the previous minimum on ties and otherwise takes the rightmost (robust winnowing)", () => {
    const fingerprints = winnow(stream(Array(10).fill("a")), {
      k: 2,
      window: 3,
    });

    expect(fingerprints.map((f) => f.position)).toEqual([2, 5, 8]);
  });

  it("never emits a position twice", () => {
    const positions = winnow(seeded(500, 3)).map((f) => f.position);

    expect(new Set(positions).size).toBe(positions.length);
  });

  it("is deterministic", () => {
    expect(winnow(seeded(100))).toEqual(winnow(seeded(100)));
  });
});
