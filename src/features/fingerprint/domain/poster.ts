import { bandColor, type PosterThemeId } from "./palettes";
import { buildPrint } from "./print";
import type { Profile } from "./profile";
import type { Traits } from "./traits";

export type PosterSize = "portrait" | "square" | "landscape";

export interface PosterOptions {
  theme: PosterThemeId;
  size: PosterSize;
}

export interface PosterModel {
  width: number;
  height: number;
  /** Where the print's centre sits, and how much it is scaled. */
  print: { cx: number; cy: number; scale: number };
  ridges: { id: string; d: string; color: string }[];
  ring: { angle: number; length: number }[];
  title: { text: string; fontSize: number; x: number; y: number };
  facts: string[];
  factsAt: { x: number; y: number; fontSize: number };
  legend: {
    name: string;
    percent: number;
    color: string;
    x: number;
    y: number;
  }[];
  note: string | null;
  mark: { x: number; y: number };
}

export const RING_RADIUS = 222;
export const MAX_TICK = 18;
export const LEGEND_FONT_SIZE = 16;
/** Print units from the centre to the tip of the longest tick. */
const PRINT_RADIUS = RING_RADIUS + MAX_TICK;

const QUIET_NOTE = "Not much public activity yet.";
const SANS_CHAR_RATIO = 0.6;
const MIN_TITLE_SIZE = 22;
const ELLIPSIS = "…";
export const FACT_GAP = "     ";

const SIZES: Record<
  PosterSize,
  {
    width: number;
    height: number;
    margin: number;
    title: number;
    facts: number;
  }
> = {
  portrait: { width: 1080, height: 1350, margin: 72, title: 88, facts: 26 },
  square: { width: 1080, height: 1080, margin: 64, title: 76, facts: 24 },
  landscape: { width: 1200, height: 627, margin: 48, title: 58, facts: 20 },
};

const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function factsFor(profile: Profile, traits: Traits): string[] {
  const facts: string[] = [];
  if (profile.stars > 0) facts.push(`${compact.format(profile.stars)} stars`);
  const top = profile.languages.find((l) => l.name !== "Other");
  if (top) facts.push(`${top.name} ${Math.round(top.share * 100)}%`);
  if (traits.peakHour !== null) {
    facts.push(`peak ${String(traits.peakHour).padStart(2, "0")}:00 UTC`);
  }
  return facts;
}

/** The name at the largest size that fits, shortened only if even the smallest doesn't. */
function fitTitle(
  name: string,
  preferred: number,
  available: number,
): { text: string; fontSize: number } {
  const widthAt = (size: number) => name.length * size * SANS_CHAR_RATIO;
  if (widthAt(preferred) <= available)
    return { text: name, fontSize: preferred };
  const fontSize = available / (name.length * SANS_CHAR_RATIO);
  if (fontSize >= MIN_TITLE_SIZE) return { text: name, fontSize };
  const maxChars = Math.floor(available / (MIN_TITLE_SIZE * SANS_CHAR_RATIO));
  return {
    text: name.slice(0, maxChars - 1) + ELLIPSIS,
    fontSize: MIN_TITLE_SIZE,
  };
}

/** Lays language labels out in rows that wrap at the available width. */
function layoutLegend(
  profile: Profile,
  theme: PosterThemeId,
  x: number,
  y: number,
  available: number,
): { items: PosterModel["legend"]; rows: number } {
  const rowHeight = LEGEND_FONT_SIZE * 1.9;
  let cursor = x;
  let rows = profile.languages.length > 0 ? 1 : 0;
  const items = profile.languages.map((language, band) => {
    const percent = Math.round(language.share * 100);
    const width =
      22 +
      `${language.name} ${percent}%`.length *
        LEGEND_FONT_SIZE *
        SANS_CHAR_RATIO +
      22;
    if (cursor > x && cursor + width > x + available) {
      cursor = x;
      rows++;
    }
    const item = {
      name: language.name,
      percent,
      color: bandColor(theme, band),
      x: cursor,
      y: y + (rows - 1) * rowHeight,
    };
    cursor += width;
    return item;
  });
  return { items, rows };
}

/** Places everything on the poster. Portrait and square stack; landscape sits side by side. */
export function layoutPoster(
  profile: Profile,
  traits: Traits,
  options: PosterOptions,
): PosterModel {
  const {
    width,
    height,
    margin,
    title: titleSize,
    facts: factsSize,
  } = SIZES[options.size];
  const sideBySide = options.size === "landscape";

  const printDiameter = sideBySide ? height - 2 * margin : width - 2 * margin;
  const textWidth = sideBySide
    ? width - 2 * margin - printDiameter - 32
    : width - 2 * margin;

  const fitted = fitTitle(profile.name, titleSize, textWidth);
  const titleBlock = fitted.fontSize * 1.1;
  const factsBlock = factsSize * 1.9;

  // Measure the legend first: its row count decides how much room the print gets.
  const measured = layoutLegend(profile, options.theme, margin, 0, textWidth);
  const legendBlock = measured.rows * LEGEND_FONT_SIZE * 1.9;
  const textHeight = titleBlock + factsBlock + legendBlock;

  let print: PosterModel["print"];
  let textTop: number;
  if (sideBySide) {
    const scale = printDiameter / (2 * PRINT_RADIUS);
    print = {
      cx: width - margin - PRINT_RADIUS * scale,
      cy: height / 2,
      scale,
    };
    textTop = (height - textHeight) / 2;
  } else {
    const available = height - 2 * margin - textHeight - 24;
    const scale = Math.min(printDiameter, available) / (2 * PRINT_RADIUS);
    print = {
      cx: width / 2,
      cy: margin + available / 2,
      scale,
    };
    textTop = height - margin - textHeight;
  }

  const facts = factsFor(profile, traits);
  const factsWidth = facts.join(FACT_GAP).length * SANS_CHAR_RATIO;
  const factsFontSize =
    factsWidth > 0 ? Math.min(factsSize, textWidth / factsWidth) : factsSize;

  const titleY = textTop + fitted.fontSize * 0.9;
  const factsY = textTop + titleBlock + factsSize * 1.3;
  const legendY = textTop + titleBlock + factsBlock + LEGEND_FONT_SIZE * 1.1;

  return {
    width,
    height,
    print,
    ridges: buildPrint(traits).map((ridge) => ({
      id: ridge.id,
      d: ridge.d,
      color: bandColor(options.theme, ridge.band),
    })),
    ring: traits.ring.map((value, hour) => ({
      angle: (hour / 24) * Math.PI * 2 - Math.PI / 2,
      length: value * MAX_TICK,
    })),
    title: { ...fitted, x: margin, y: titleY },
    facts,
    factsAt: { x: margin, y: factsY, fontSize: factsFontSize },
    legend: layoutLegend(profile, options.theme, margin, legendY, textWidth)
      .items,
    note: traits.quiet ? QUIET_NOTE : null,
    mark: { x: width - margin, y: height - margin / 2 },
  };
}
