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

  it("ignores the newline that ends a pasted file", async () => {
    expect(await highlight("a();\nb();\n", "javascript", theme)).toHaveLength(
      2,
    );
  });

  it("returns one line per source line, keeping empty ones", async () => {
    const lines = await highlight("a();\n\nb();", "javascript", theme);

    expect(lines).toHaveLength(3);
    expect(lines[1]).toEqual([]);
    expect(lines[2]!.map((t) => t.text).join("")).toBe("b();");
  });

  // A grammar is compiled on first use; C++ alone takes a couple of seconds cold.
  it.each(LANGUAGES)(
    "highlights %s without throwing",
    async (language) => {
      await expect(highlight("x", language, theme)).resolves.toHaveLength(1);
    },
    20_000,
  );

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

  it("only highlights what the image can show, plus enough to flag the cut", async () => {
    const huge = Array.from({ length: 5000 }, () => "y".repeat(2000)).join(
      "\n",
    );

    const lines = await highlight(huge, "javascript", theme);

    expect(lines).toHaveLength(81);
    expect(lines[0]!.map((t) => t.text).join("").length).toBe(480);
  });

  it("creates the highlighter once and reuses it", async () => {
    const first = getHighlighter();
    await highlight("b", "rust", getSnapshotTheme("paper"));

    expect(getHighlighter()).toBe(first);
  });
});
