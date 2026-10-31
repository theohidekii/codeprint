import { buildQueries } from "./queries";
import { tokenize } from "./tokenize";

const build = (source: string) =>
  buildQueries(source, tokenize(source, "javascript"));
const byKind = (source: string, kind: string) =>
  build(source).filter((q) => q.kind === kind);

describe("buildQueries", () => {
  it("uses the longest line of at least 20 characters as the exact query", () => {
    const source =
      "const a = 1;\n  const longerName = computeSomething(a);\nx();";

    expect(byKind(source, "exact")).toEqual([
      {
        kind: "exact",
        pattern: "const longerName = computeSomething(a);",
        regex: false,
      },
    ]);
  });

  it("skips the exact query when no line is long enough", () => {
    expect(byKind("a = 1;\nb = 2;", "exact")).toEqual([]);
  });

  it("builds a structural regex where names become wildcards", () => {
    const [structural] = byKind(
      "let acc = 0;\nfor (const v of values) acc += v;",
      "structural",
    );

    expect(structural).toEqual({
      kind: "structural",
      pattern: String.raw`let\s+\w+\s*=\s*\d[\w.]*\s*;\s*\n\s*for\s*\(\s*const\s+\w+\s+of\s+\w+\s*\)\s*\w+\s*\+=\s*\w+\s*;`,
      regex: true,
    });
  });

  it("spans at most the 3 consecutive lines with the most tokens", () => {
    const source =
      "a;\nb;\nlet x = f(a, b, c);\nlet y = g(d, e, f);\nlet z = h(x, y);\nc;";
    const [structural] = byKind(source, "structural");

    expect(structural!.pattern.split(String.raw`\n`)).toHaveLength(3);
    expect(
      new RegExp(structural!.pattern).test(
        "let x = f(a, b, c);\nlet y = g(d, e, f);\nlet z = h(x, y);",
      ),
    ).toBe(true);
  });

  it("escapes regex metacharacters from the snippet", () => {
    const source = "const r = a.b(c)[0] + d*e?f:g;";
    const [structural] = byKind(source, "structural");

    for (const escaped of [
      String.raw`\.`,
      String.raw`\(`,
      String.raw`\[`,
      String.raw`\*`,
      String.raw`\?`,
    ]) {
      expect(structural!.pattern).toContain(escaped);
    }
    expect(new RegExp(structural!.pattern).test(source)).toBe(true);
  });

  it("turns string literals into quoted wildcards", () => {
    const [structural] = byKind('log("created", id);', "structural");

    expect(structural!.pattern).toContain(String.raw`"[^"\n]*"`);
    expect(
      new RegExp(structural!.pattern).test('log("anything else", userId);'),
    ).toBe(true);
  });

  it("uses rare string literals and member names as anchors", () => {
    const source = [
      'notify(user, "Welcome aboard!");',
      'notify(admin, "Welcome aboard!");',
      'audit.recordEvent("signup-completed");',
      "cache.invalidate(user.id);",
    ].join("\n");

    expect(byKind(source, "anchor")).toEqual([
      { kind: "anchor", pattern: "signup-completed", regex: false },
      { kind: "anchor", pattern: "Welcome aboard!", regex: false },
      { kind: "anchor", pattern: ".recordEvent", regex: false },
      { kind: "anchor", pattern: ".invalidate", regex: false },
    ]);
  });

  it("caps the exact query at 200 characters", () => {
    const long = `const x = [${Array.from({ length: 400 }, (_, i) => i).join(", ")}];`;
    const [exact] = byKind(long, "exact");

    expect(exact!.pattern.length).toBeLessThanOrEqual(200);
    expect(long).toContain(exact!.pattern);
  });

  it("caps the structural query at 40 tokens and still matches the source", () => {
    const long = `const x = [${Array.from({ length: 400 }, (_, i) => i).join(", ")}];`;
    const [structural] = byKind(long, "structural");

    expect(structural!.pattern.length).toBeLessThan(600);
    expect(new RegExp(structural!.pattern).test(long)).toBe(true);
  });

  it("never puts literal whitespace in the structural query", () => {
    // Search engines split queries on whitespace into operators and filters.
    const [structural] = byKind(
      'if (a and not b) { log("count: 5 repo:x"); }',
      "structural",
    );

    expect(structural!.pattern).not.toMatch(/\s/);
  });

  it("orders queries exact, structural, then anchors", () => {
    const kinds = build(
      'const message = format("hello there", name);\nsend(message.trimmed);',
    ).map((q) => q.kind);

    expect(kinds).toEqual(["exact", "structural", "anchor", "anchor"]);
  });
});
