// @vitest-environment node
import { LANGUAGES } from "@/features/trace/domain/types";

import { getSnapshotTheme } from "../domain/themes";
import { getHighlighter, highlight } from "./highlight";

const theme = getSnapshotTheme("latent-dark");

describe("highlight", () => {
  it("colors keywords, strings and names differently and keeps the text intact", async () => {
    const [line] = await highlight('const a = "x";', "javascript", theme);
    const colorOf = (text: string) =>
      line!.find((t) => t.text.includes(text))!.color;

    expect(line!.map((t) => t.text).join("")).toBe('const a = "x";');
    expect(new Set([colorOf("const"), colorOf('"x"'), colorOf("a")]).size).toBe(
      3,
    );
  });

  it("returns one line per source line, keeping empty ones", async () => {
    const lines = await highlight("a();\n\nb();", "javascript", theme);

    expect(lines).toHaveLength(3);
    expect(lines[1]).toEqual([]);
    expect(lines[2]!.map((t) => t.text).join("")).toBe("b();");
  });

  it.each(LANGUAGES)("highlights %s without throwing", async (language) => {
    await expect(highlight("x", language, theme)).resolves.toHaveLength(1);
  });

  it("renders generic code in the editor foreground", async () => {
    const [line] = await highlight("hello world", "generic", theme);

    expect(
      line!.every((t) => t.color.toLowerCase().startsWith(theme.text)),
    ).toBe(true);
  });

  it("maps italic comments to the italic font style", async () => {
    const [line] = await highlight("// note", "javascript", theme);

    expect(line!.some((t) => t.fontStyle === "italic")).toBe(true);
  });

  it("creates the highlighter once and reuses it", async () => {
    const first = getHighlighter();
    await highlight("b", "rust", getSnapshotTheme("paper"));

    expect(getHighlighter()).toBe(first);
  });
});
