import {
  getSnapshotTheme,
  type SnapshotThemeId,
} from "@/features/snapshot/domain/themes";

export type PosterThemeId = Exclude<SnapshotThemeId, "terminal">;

export const POSTER_THEMES: readonly PosterThemeId[] = [
  "latent-dark",
  "latent-light",
  "cyanotype",
  "paper",
];

/** One color per language band: top five languages, then "Other". */
const PALETTES: Record<PosterThemeId, readonly string[]> = {
  "latent-dark": [
    "#c08be6",
    "#8cc8ff",
    "#9fd8b0",
    "#f0b37e",
    "#f2d27a",
    "#a4a2b8",
  ],
  "latent-light": [
    "#6a2c91",
    "#1d5fae",
    "#1f7a4d",
    "#a14a00",
    "#7a5200",
    "#535a70",
  ],
  cyanotype: ["#ffd24a", "#ffffff", "#a8e6cf", "#ffb38a", "#c6d8ff", "#b9c8e0"],
  paper: ["#b3261e", "#1f4f8a", "#2f6b3a", "#8a4b00", "#5b3f8c", "#625d55"],
};

/** The color of a language band. Ridges with no language (-1) use the theme's accent. */
export function bandColor(theme: PosterThemeId, band: number): string {
  if (band < 0) return getSnapshotTheme(theme).accent;
  const palette = PALETTES[theme];
  return palette[band % palette.length]!;
}
