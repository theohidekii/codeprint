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

  it("ignores tiny coincidental matches when locating code and renames", () => {
    // `function resolve(key) {` shares a short token run with the snippet's first line.
    const decoy = "function resolve(key) {\n  return cache.get(key);\n}\n\n";
    const { regions, renames } = compare(
      prepare(SUM_POSITIVE),
      prepare(decoy + SUM_POSITIVE_RENAMED),
    );

    expect(regions).toHaveLength(1);
    expect(regions[0]!.candidate.start).toBe(5);
    expect(renames).toContainEqual({ from: "sumPositive", to: "addUp" });
    expect(renames.some((r) => r.to === "resolve" || r.to === "key")).toBe(
      false,
    );
  });

  it("takes renames from the main match only", () => {
    // A second, similar function elsewhere in the file must not suggest renames.
    const lookalike = [
      "function check(items) {",
      "  let total = 0;",
      "  for (const n of items) {",
      "    return total;",
      "  }",
      "}",
    ].join("\n");

    const { renames } = compare(
      prepare(SUM_POSITIVE),
      prepare(`${lookalike}\n\n${SUM_POSITIVE}`),
    );

    expect(renames).toEqual([]);
  });

  it("lists the largest matching region first", () => {
    const head = SUM_POSITIVE.split("\n").slice(0, 3).join("\n");
    const candidate = `${head}\n  // unrelated\n}\n\n${SUM_POSITIVE_RENAMED}`;

    const { regions } = compare(prepare(SUM_POSITIVE), prepare(candidate));

    expect(regions[0]!.candidate.start).toBeGreaterThan(5);
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
