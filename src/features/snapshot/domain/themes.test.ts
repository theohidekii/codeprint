import { getSnapshotTheme, SNAPSHOT_THEMES } from "./themes";

/** WCAG 2 contrast ratio between two #rrggbb colors. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe("snapshot themes", () => {
  it("offers the five themes in order", () => {
    expect(SNAPSHOT_THEMES.map((t) => t.id)).toEqual([
      "latent-dark",
      "latent-light",
      "cyanotype",
      "paper",
      "terminal",
    ]);
    expect(getSnapshotTheme("paper").label).toBe("Paper");
  });

  it("matches the Latent identity", () => {
    expect(getSnapshotTheme("latent-dark")).toMatchObject({
      card: "#1b1b28",
      accent: "#c08be6",
    });
  });

  it.each(SNAPSHOT_THEMES.map((t) => [t.id, t] as const))(
    "%s keeps every code color readable (AA) on its card",
    (_, theme) => {
      const colors = [
        theme.shiki.colors["editor.foreground"]!,
        theme.muted,
        ...theme.shiki.tokenColors.flatMap((rule) =>
          rule.settings.foreground ? [rule.settings.foreground] : [],
        ),
      ];
      for (const color of colors) {
        expect(
          contrast(color, theme.card),
          `${theme.id}: ${color} on ${theme.card}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});
