import { CHAR_WIDTH_RATIO, cellWidth, columns } from "./text-width";

describe("text width", () => {
  it("pins Fragment Mono's measured advance ratio", () => {
    expect(CHAR_WIDTH_RATIO).toBe(0.618);
  });

  it.each([
    ["abc", 3],
    ["a\tb", 4],
    ["日本", 4],
    ["👍x", 3],
    ["", 0],
  ])("measures %j as %i columns", (text, expected) => {
    expect(columns(text)).toBe(expected);
  });

  it("treats wide characters as two cells", () => {
    expect(cellWidth("a")).toBe(1);
    expect(cellWidth("한")).toBe(2);
    expect(cellWidth("🚀")).toBe(2);
  });
});
