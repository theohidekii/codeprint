import { normalize } from "./normalize";
import { tokenize } from "./tokenize";

const values = (source: string) =>
  normalize(tokenize(source, "javascript")).map((t) => t.value);

describe("normalize", () => {
  it("replaces identifiers, strings and numbers with placeholders", () => {
    expect(values('let name = "Ada" + 42;')).toEqual([
      "let",
      "ID",
      "=",
      "STR",
      "+",
      "NUM",
      ";",
    ]);
  });

  it("keeps keywords, operators and punctuation", () => {
    expect(values("return a === b;")).toEqual([
      "return",
      "ID",
      "===",
      "ID",
      ";",
    ]);
  });

  it("makes code that differs only by renaming identical", () => {
    const original =
      "function sum(values){let acc=0;for(const v of values)acc+=v;return acc}";
    const renamed =
      "function total(items){let s=0;for(const x of items)s+=x;return s}";

    expect(values(renamed)).toEqual(values(original));
  });

  it("keeps a reference to the source token", () => {
    const result = normalize(tokenize("function sum() {}", "javascript"));

    expect(result[1]?.token.text).toBe("sum");
    expect(result[1]?.value).toBe("ID");
  });
});
