import { tokenize } from "./tokenize";

const texts = (source: string) =>
  tokenize(source, "javascript").map((t) => t.text);
const kinds = (source: string) =>
  tokenize(source, "javascript").map((t) => t.kind);

describe("tokenize (c-like)", () => {
  it("classifies keywords, identifiers, operators, numbers and punctuation", () => {
    expect(kinds("const total = 1;")).toEqual([
      "keyword",
      "identifier",
      "operator",
      "number",
      "punctuation",
    ]);
    expect(texts("const total = 1;")).toEqual([
      "const",
      "total",
      "=",
      "1",
      ";",
    ]);
  });

  it("drops comments and whitespace but keeps line numbers", () => {
    const tokens = tokenize("a // x\n/* y */ b", "javascript");

    expect(tokens.map((t) => t.text)).toEqual(["a", "b"]);
    expect(tokens.map((t) => t.line)).toEqual([1, 2]);
  });

  it("counts lines inside block comments", () => {
    expect(tokenize("/* a\nb\n*/ c", "javascript")[0]?.line).toBe(3);
  });

  it.each([String.raw`'it\'s'`, String.raw`"a\"b"`, "`x${y}`"])(
    "keeps the string %s as one token",
    (source) => {
      expect(kinds(source)).toEqual(["string"]);
      expect(texts(source)).toEqual([source]);
    },
  );

  it.each(["0x1F", "1_000", "3.14e-2", "10n", ".5"])(
    "reads %s as one number",
    (source) => {
      expect(kinds(source)).toEqual(["number"]);
    },
  );

  it("reads multi-character operators as single tokens", () => {
    expect(texts("=== !== => ?? ?. ++ && || >>> **=")).toEqual([
      "===",
      "!==",
      "=>",
      "??",
      "?.",
      "++",
      "&&",
      "||",
      ">>>",
      "**=",
    ]);
  });

  it("never throws on unterminated strings or comments", () => {
    expect(tokenize('"abc', "javascript")).toMatchObject([
      { kind: "string", text: '"abc' },
    ]);
    expect(tokenize("/* open", "javascript")).toEqual([]);
  });

  it("records source offsets", () => {
    expect(tokenize("ab  cd", "javascript")[1]).toMatchObject({
      start: 4,
      end: 6,
    });
  });

  it("reads unicode identifiers", () => {
    expect(kinds("const preço = 1")).toEqual([
      "keyword",
      "identifier",
      "operator",
      "number",
    ]);
  });

  it("does not let a string run past its line when it is not a template", () => {
    expect(tokenize('"abc\nd', "javascript").map((t) => t.text)).toEqual([
      '"abc',
      "d",
    ]);
  });
});
