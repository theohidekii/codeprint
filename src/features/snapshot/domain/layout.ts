import type { PaddingPreset, SizePreset, SnapshotOptions } from "./options";
import { CHAR_WIDTH_RATIO, cellWidth, columns, TAB_WIDTH } from "./text-width";

export interface ColoredToken {
  text: string;
  color: string;
  fontStyle?: "italic" | "bold";
}
export type ColoredLine = ColoredToken[];

export interface PlacedToken {
  /** Relative to the card, before scaling. */
  x: number;
  text: string;
  color: string;
  fontStyle?: "italic" | "bold";
}

export interface PlacedLine {
  number: number;
  /** Top of the line box, relative to the card, before scaling. */
  y: number;
  tokens: PlacedToken[];
  dimmed: boolean;
  highlighted: boolean;
}

export interface SnapshotModel {
  width: number;
  height: number;
  /** Position in the image; width and height are unscaled, `scale` shrinks it to fit. */
  card: { x: number; y: number; width: number; height: number; scale: number };
  bar: { height: number; title: string } | null;
  gutter: { width: number } | null;
  lines: PlacedLine[];
  /** `y` is the caption's baseline in image coordinates. */
  caption: { text: string; y: number } | null;
  truncated: { lines: boolean; columns: boolean };
  fontSize: number;
  lineHeight: number;
  charWidth: number;
}

export const FONT_SIZE = 16;
export const LINE_HEIGHT = FONT_SIZE * 1.6;
export const MAX_LINES = 80;
export const MAX_COLUMNS = 120;
const CARD_PADDING = 28;
const BAR_HEIGHT = 44;
const GUTTER_GAP = 20;
const CAPTION_SPACE = 40;
const ELLIPSIS = "…";

const OUTER_PADDING: Record<PaddingPreset, number> = {
  compact: 32,
  comfortable: 56,
  spacious: 88,
};

const FIXED_SIZES: Record<Exclude<SizePreset, "auto">, [number, number]> = {
  linkedin: [1200, 627],
  square: [1080, 1080],
};

/** Expands tabs and cuts the line at MAX_COLUMNS, ending with an ellipsis when cut. */
function fitLine(line: ColoredLine): {
  tokens: ColoredLine;
  cols: number;
  cut: boolean;
} {
  const tokens: ColoredLine = [];
  let cols = 0;
  for (const token of line) {
    const text = token.text.replaceAll("\t", " ".repeat(TAB_WIDTH));
    const width = columns(text);
    if (cols + width <= MAX_COLUMNS) {
      tokens.push({ ...token, text });
      cols += width;
      continue;
    }
    // Keep what fits in MAX_COLUMNS - 1, then the ellipsis.
    let kept = "";
    for (const char of text) {
      if (cols + cellWidth(char) > MAX_COLUMNS - 1) break;
      kept += char;
      cols += cellWidth(char);
    }
    tokens.push({ ...token, text: kept + ELLIPSIS });
    return { tokens, cols: cols + 1, cut: true };
  }
  return { tokens, cols, cut: false };
}

/** Turns colored lines and options into absolute positions for the renderer. */
export function layoutSnapshot(
  source: ColoredLine[],
  options: SnapshotOptions,
  languageLabel: string,
): SnapshotModel {
  const charWidth = FONT_SIZE * CHAR_WIDTH_RATIO;
  const visible = source.slice(0, MAX_LINES);
  const fitted = visible.map(fitLine);
  const maxCols = Math.max(1, ...fitted.map((l) => l.cols));

  const bar =
    options.frame === "window"
      ? { height: BAR_HEIGHT, title: options.title || languageLabel }
      : null;
  const gutter = options.lineNumbers
    ? { width: String(visible.length).length * charWidth + GUTTER_GAP }
    : null;

  const top = (bar?.height ?? 0) + CARD_PADDING;
  const left = CARD_PADDING + (gutter?.width ?? 0);
  const anyHighlighted = options.highlighted.length > 0;

  const lines: PlacedLine[] = fitted.map(({ tokens }, i) => {
    const number = i + 1;
    let x = left;
    const placed = tokens.map((token) => {
      const at = x;
      x += columns(token.text) * charWidth;
      return { ...token, x: at };
    });
    const highlighted = options.highlighted.includes(number);
    return {
      number,
      y: top + i * LINE_HEIGHT,
      tokens: placed,
      highlighted,
      dimmed: anyHighlighted && !highlighted,
    };
  });

  const cardWidth = left + maxCols * charWidth + CARD_PADDING;
  const cardHeight = top + visible.length * LINE_HEIGHT + CARD_PADDING;
  const pad = OUTER_PADDING[options.padding];
  const captionSpace = options.caption ? CAPTION_SPACE : 0;

  let width: number;
  let height: number;
  let scale = 1;
  if (options.size === "auto") {
    width = cardWidth + 2 * pad;
    height = cardHeight + 2 * pad + captionSpace;
  } else {
    [width, height] = FIXED_SIZES[options.size];
    scale = Math.min(
      1,
      (width - 2 * pad) / cardWidth,
      (height - 2 * pad - captionSpace) / cardHeight,
    );
  }

  const x = (width - cardWidth * scale) / 2;
  const y =
    options.size === "auto"
      ? pad
      : (height - captionSpace - cardHeight * scale) / 2;

  return {
    width,
    height,
    card: { x, y, width: cardWidth, height: cardHeight, scale },
    bar,
    gutter,
    lines,
    caption: options.caption
      ? { text: options.caption, y: y + cardHeight * scale + 28 }
      : null,
    truncated: {
      lines: source.length > MAX_LINES,
      columns: fitted.some((l) => l.cut),
    },
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    charWidth,
  };
}
