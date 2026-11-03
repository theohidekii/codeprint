import type { SnapshotTheme } from "@/features/snapshot/domain/themes";
import type { EmbeddedFonts } from "@/shared/lib/export/fonts";
import { escapeXml, fontFaces } from "@/shared/lib/svg";

import { LEGEND_FONT_SIZE, type PosterModel, RING_RADIUS } from "./poster";

const SANS = "'Schibsted Grotesk', ui-sans-serif, sans-serif";
const RIDGE_WIDTH = 3;
/** Even an hour with no activity leaves a stub, so the ring reads as a full clock. */
const TICK_STUB = 2;

function print(model: PosterModel, theme: SnapshotTheme): string {
  const { cx, cy, scale } = model.print;
  const ridges = model.ridges
    .map(
      (ridge) => `<path data-ridge="" d="${ridge.d}" stroke="${ridge.color}"/>`,
    )
    .join("");
  const ticks = model.ring
    .map(({ angle, length }) => {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const end = RING_RADIUS + TICK_STUB + length;
      return `<line data-tick="" x1="${cos * RING_RADIUS}" y1="${sin * RING_RADIUS}" x2="${cos * end}" y2="${sin * end}"/>`;
    })
    .join("");

  return (
    `<g transform="translate(${cx} ${cy}) scale(${scale})">` +
    `<defs><clipPath id="poster-fingertip"><ellipse cx="0" cy="0" rx="172" ry="208"/></clipPath></defs>` +
    `<g clip-path="url(#poster-fingertip)" fill="none" stroke-width="${RIDGE_WIDTH}" stroke-linecap="round" stroke-linejoin="round">${ridges}</g>` +
    `<g stroke="${theme.accent}" stroke-width="3" stroke-linecap="round">${ticks}</g>` +
    `</g>`
  );
}

function text(model: PosterModel, theme: SnapshotTheme): string {
  const { title, factsAt } = model;
  const line = model.note ?? model.facts.join("     ");
  const legend = model.legend
    .map(
      (item) =>
        `<circle cx="${item.x + 7}" cy="${item.y - 5}" r="6" fill="${item.color}"/>` +
        `<text x="${item.x + 22}" y="${item.y}" font-size="${LEGEND_FONT_SIZE}" fill="${theme.muted}" font-family="${SANS}" font-weight="700">${escapeXml(`${item.name} ${item.percent < 1 ? "<1" : item.percent}%`)}</text>`,
    )
    .join("");

  return (
    `<text data-title="" x="${title.x}" y="${title.y}" font-size="${title.fontSize}" fill="${theme.text}" font-family="${SANS}" font-weight="700" letter-spacing="-0.02em">${escapeXml(title.text)}</text>` +
    `<text data-facts="" x="${factsAt.x}" y="${factsAt.y}" font-size="${factsAt.fontSize}" fill="${theme.muted}" font-family="${SANS}" font-weight="700" xml:space="preserve">${escapeXml(line)}</text>` +
    legend +
    `<text data-mark="" x="${model.mark.x}" y="${model.mark.y}" text-anchor="end" font-size="15" fill="${theme.muted}" font-family="${SANS}" font-weight="700">codeprint</text>`
  );
}

/** Renders a poster to a standalone SVG document. Same model, same bytes. */
export function renderPoster(
  model: PosterModel,
  theme: SnapshotTheme,
  fonts?: EmbeddedFonts,
): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${model.width}" height="${model.height}" viewBox="0 0 ${model.width} ${model.height}">` +
    `<style>${fonts ? fontFaces(fonts) : ""}</style>` +
    `<rect width="${model.width}" height="${model.height}" fill="${theme.background}"/>` +
    print(model, theme) +
    text(model, theme) +
    `</svg>`
  );
}
