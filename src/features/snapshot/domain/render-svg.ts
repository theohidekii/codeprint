import { buildRidges } from "@/features/landing/lib/ridges";

import { FONT_SIZE, type SnapshotModel } from "./layout";
import type { BackgroundStyle } from "./options";
import type { SnapshotTheme } from "./themes";

export interface EmbeddedFonts {
  /** data: URL of Fragment Mono. */
  mono: string;
  /** data: URL of Schibsted Grotesk Bold. */
  sans: string;
}

const MONO = "'Fragment Mono', ui-monospace, monospace";
/** Attributes for code text: set per element so the title and caption keep their own font. */
const CODE_FONT = `font-family="${MONO}" font-size="${FONT_SIZE}" style="font-variant-ligatures:none"`;
const SANS = "'Schibsted Grotesk', ui-sans-serif, sans-serif";
const DIMMED_OPACITY = "0.45";
const CARD_RADIUS = 14;

// Characters XML 1.0 cannot contain at all, even escaped.
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

/** The one escaping function used for every text node and attribute value. */
function escapeXml(text: string): string {
  return text
    .replace(INVALID_XML, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function fontFaces(fonts: EmbeddedFonts): string {
  return [
    `@font-face{font-family:'Fragment Mono';src:url(${fonts.mono}) format('woff2');}`,
    `@font-face{font-family:'Schibsted Grotesk';font-weight:700;src:url(${fonts.sans}) format('woff2');}`,
  ].join("");
}

function background(
  model: SnapshotModel,
  theme: SnapshotTheme,
  style: BackgroundStyle,
): string {
  if (style === "none") return "";
  const fill = `<rect data-background="" width="${model.width}" height="${model.height}" fill="${theme.background}"/>`;
  if (style === "solid") return fill;

  // The fingerprint motif, large and faint, anchored to the right of the image.
  const size = Math.max(model.width, model.height);
  const scale = size / 300;
  const paths = buildRidges()
    .map((ridge) => `<path d="${ridge.d}"/>`)
    .join("");
  return `${fill}<defs><clipPath id="snapshot-fingertip"><ellipse cx="0" cy="0" rx="128" ry="160"/></clipPath></defs><g data-ridges="" clip-path="url(#snapshot-fingertip)" fill="none" stroke="${theme.accent}" stroke-width="${1.6 / scale}" opacity="0.12" transform="translate(${model.width * 0.82} ${model.height * 0.5}) scale(${scale})">${paths}</g>`;
}

function windowBar(model: SnapshotModel, theme: SnapshotTheme): string {
  if (!model.bar) return "";
  const { height, title } = model.bar;
  const dots = [theme.accent, theme.muted, theme.muted]
    .map(
      (color, i) =>
        `<circle data-dot="" cx="${24 + i * 18}" cy="${height / 2}" r="5.5" fill="${color}" opacity="${i === 0 ? 1 : 0.45}"/>`,
    )
    .join("");
  return (
    dots +
    `<text data-title="" x="${model.card.width / 2}" y="${height / 2 + 5}" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="13" fill="${theme.muted}">${escapeXml(title)}</text>` +
    `<line x1="0" y1="${height}" x2="${model.card.width}" y2="${height}" stroke="${theme.cardBorder}"/>`
  );
}

function codeLines(model: SnapshotModel, theme: SnapshotTheme): string {
  const baseline = model.lineHeight / 2 + model.fontSize * 0.35;
  const numberX = model.gutter ? 28 + model.gutter.width - 20 : 0;

  return model.lines
    .map((line) => {
      const opacity = line.dimmed ? ` opacity="${DIMMED_OPACITY}"` : "";
      const wash = line.highlighted
        ? `<rect data-highlight="${line.number}" x="0" y="${line.y}" width="${model.card.width}" height="${model.lineHeight}" fill="${theme.highlight}"/>`
        : "";
      const number = model.gutter
        ? `<text data-number="${line.number}" x="${numberX}" y="${line.y + baseline}" text-anchor="end" ${CODE_FONT} fill="${theme.muted}"${opacity}>${line.number}</text>`
        : "";
      const spans = line.tokens
        .map((token) => {
          const style =
            token.fontStyle === "italic"
              ? ` font-style="italic"`
              : token.fontStyle === "bold"
                ? ` font-weight="700"`
                : "";
          return `<tspan x="${token.x}" fill="${token.color}"${style}>${escapeXml(token.text)}</tspan>`;
        })
        .join("");
      return `${wash}${number}<text data-line="${line.number}" y="${line.y + baseline}" ${CODE_FONT} xml:space="preserve"${opacity}>${spans}</text>`;
    })
    .join("");
}

/** Renders a laid-out snapshot to a standalone SVG document. */
export function renderSvg(
  model: SnapshotModel,
  theme: SnapshotTheme,
  options: { background: BackgroundStyle; fonts?: EmbeddedFonts },
): string {
  const { card } = model;
  const style = `<style>${options.fonts ? fontFaces(options.fonts) : ""}</style>`;
  const caption = model.caption
    ? `<text data-caption="" x="${model.width / 2}" y="${model.caption.y}" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="15" fill="${theme.muted}">${escapeXml(model.caption.text)}</text>`
    : "";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${model.width}" height="${model.height}" viewBox="0 0 ${model.width} ${model.height}">` +
    style +
    background(model, theme, options.background) +
    `<g data-card="" transform="translate(${card.x} ${card.y}) scale(${card.scale})">` +
    `<rect width="${card.width}" height="${card.height}" rx="${CARD_RADIUS}" fill="${theme.card}" stroke="${theme.cardBorder}"/>` +
    windowBar(model, theme) +
    codeLines(model, theme) +
    `</g>` +
    caption +
    `</svg>`
  );
}
