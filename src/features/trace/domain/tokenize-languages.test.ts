import { detectLanguage, tokenize } from "./tokenize";
import type { Language } from "./types";

const texts = (source: string, language: Language) =>
  tokenize(source, language).map((t) => t.text);

describe("tokenize (other languages)", () => {
  it("handles Python comments, keywords and triple-quoted strings", () => {
    const tokens = tokenize(
      '# note\ndef f(x):\n    """doc\nmore"""\n    return x',
      "python",
    );

    expect(tokens.map((t) => t.text)).toEqual([
      "def",
      "f",
      "(",
      "x",
      ")",
      ":",
      '"""doc\nmore"""',
      "return",
      "x",
    ]);
    expect(tokens.find((t) => t.text === "def")?.kind).toBe("keyword");
    expect(tokens.find((t) => t.text === "return")).toMatchObject({
      kind: "keyword",
      line: 5,
    });
    expect(texts("'''a'''", "python")).toEqual(["'''a'''"]);
  });

  it("handles Ruby comments and blocks", () => {
    const tokens = tokenize("# hi\ndef x\n  1\nend", "ruby");

    expect(tokens.map((t) => [t.text, t.kind])).toEqual([
      ["def", "keyword"],
      ["x", "identifier"],
      ["1", "number"],
      ["end", "keyword"],
    ]);
  });

  it("handles every PHP comment style and $variables", () => {
    expect(texts("# a\n// b\n/* c */ $name = 1;", "php")).toEqual([
      "$name",
      "=",
      "1",
      ";",
    ]);
    expect(tokenize("$name", "php")[0]?.kind).toBe("identifier");
  });

  it("reads Go raw strings across lines", () => {
    expect(texts("x := `a\nb`", "go")).toEqual(["x", ":=", "`a\nb`"]);
  });

  it("tells Rust char literals from lifetimes", () => {
    expect(tokenize("'a'", "rust")).toMatchObject([
      { kind: "string", text: "'a'" },
    ]);
    expect(texts("fn f<'a>(s: &'a str) {}", "rust")).toEqual([
      "fn",
      "f",
      "<",
      "'",
      "a",
      ">",
      "(",
      "s",
      ":",
      "&",
      "'",
      "a",
      "str",
      ")",
      "{",
      "}",
    ]);
  });
});

describe("detectLanguage", () => {
  it.each<[Language, string]>([
    ["python", "def x():\n  pass"],
    ["go", "package main\nfunc main() {}"],
    ["rust", "fn main() { let mut x = 1; }"],
    ["typescript", "const a: number = 1; interface X {}"],
    ["javascript", "const a = () => 1;"],
    ["java", "public class A { public static void main(String[] a) {} }"],
    ["php", "<?php echo $x;"],
    ["ruby", "def x\n  puts 1\nend"],
    ["csharp", "using System; namespace A { class B {} }"],
    ["c", "#include <stdio.h>\nint main(void) { return 0; }"],
    ["cpp", "#include <vector>\nstd::vector<int> v;"],
    ["generic", "hello world"],
  ])("detects %s", (language, source) => {
    expect(detectLanguage(source)).toBe(language);
  });
});
