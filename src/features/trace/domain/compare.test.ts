import {
  EMBEDDED_AT,
  EMBEDDED_FILE,
  PAIRS,
  SUM_POSITIVE,
  SUM_POSITIVE_RENAMED,
} from "./__fixtures__/pairs";
import { compare } from "./compare";
import { normalize } from "./normalize";
import { tokenize } from "./tokenize";
import type { Language } from "./types";

const prepare = (source: string, language: Language = "javascript") =>
  normalize(tokenize(source, language));

describe("compare", () => {
  it.each(PAIRS)(
    "scores $name between $min and $max",
    ({ snippet, candidate, language, min, max }) => {
      const { similarity } = compare(
        prepare(snippet, language),
        prepare(candidate, language),
      );

      expect(similarity).toBeGreaterThanOrEqual(min);
      expect(similarity).toBeLessThanOrEqual(max);
    },
  );

  it("reports the identifiers that were renamed", () => {
    const { renames } = compare(
      prepare(SUM_POSITIVE),
      prepare(SUM_POSITIVE_RENAMED),
    );

    expect(renames).toContainEqual({ from: "acc", to: "total" });
    expect(renames).toContainEqual({ from: "values", to: "items" });
    expect(renames.some((r) => r.from === r.to)).toBe(false);
  });

  it("reports no renames for an identical copy", () => {
    expect(
      compare(prepare(SUM_POSITIVE), prepare(SUM_POSITIVE)).renames,
    ).toEqual([]);
  });

  it("locates an embedded snippet by line", () => {
    const { regions } = compare(prepare(SUM_POSITIVE), prepare(EMBEDDED_FILE));
    const lines = SUM_POSITIVE.split("\n").length;

    expect(regions).toHaveLength(1);
    expect(regions[0]).toEqual({
      snippet: { start: 1, end: lines },
      candidate: { start: EMBEDDED_AT, end: EMBEDDED_AT + lines - 1 },
    });
  });

  it("returns an empty comparison for an empty candidate", () => {
    expect(compare(prepare(SUM_POSITIVE), [])).toEqual({
      similarity: 0,
      regions: [],
      renames: [],
    });
  });

  it("compares a 20,000-character snippet with itself in under 200ms", () => {
    const big = prepare(
      Array.from(
        { length: 400 },
        (_, i) => `total${i} = items[${i}] * rate + offset;`,
      ).join("\n"),
    );
    expect(big.length).toBeGreaterThan(3000);

    const started = performance.now();
    const result = compare(big, big);
    const elapsed = performance.now() - started;

    expect(result.similarity).toBe(1);
    expect(elapsed).toBeLessThan(200);
  });
});
