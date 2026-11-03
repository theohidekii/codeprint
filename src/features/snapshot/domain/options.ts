import type { SnapshotThemeId } from "./themes";

export type BackgroundStyle = "solid" | "ridges" | "none";
export type FrameStyle = "window" | "minimal";
export type SizePreset = "auto" | "linkedin" | "square";
export type PaddingPreset = "compact" | "comfortable" | "spacious";

export interface SnapshotOptions {
  theme: SnapshotThemeId;
  background: BackgroundStyle;
  frame: FrameStyle;
  title: string;
  lineNumbers: boolean;
  /** 1-based line numbers, sorted and unique. */
  highlighted: readonly number[];
  caption: string;
  size: SizePreset;
  padding: PaddingPreset;
}

export const MAX_TITLE_LENGTH = 60;
export const MAX_CAPTION_LENGTH = 120;

export const DEFAULT_OPTIONS: SnapshotOptions = {
  theme: "latent-dark",
  background: "ridges",
  frame: "window",
  title: "",
  lineNumbers: true,
  highlighted: [],
  caption: "",
  size: "auto",
  padding: "comfortable",
};

export type OptionsAction =
  | { type: "set"; patch: Partial<Omit<SnapshotOptions, "highlighted">> }
  | { type: "toggle-line"; line: number }
  | { type: "clear-highlights" };

export function optionsReducer(
  state: SnapshotOptions,
  action: OptionsAction,
): SnapshotOptions {
  switch (action.type) {
    case "set": {
      const next = { ...state, ...action.patch };
      return {
        ...next,
        title: next.title.slice(0, MAX_TITLE_LENGTH),
        caption: next.caption.slice(0, MAX_CAPTION_LENGTH),
      };
    }
    case "toggle-line": {
      const has = state.highlighted.includes(action.line);
      const highlighted = has
        ? state.highlighted.filter((line) => line !== action.line)
        : [...state.highlighted, action.line].sort((a, b) => a - b);
      return { ...state, highlighted };
    }
    case "clear-highlights":
      return { ...state, highlighted: [] };
  }
}
