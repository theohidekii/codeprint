import type { SnapshotTheme } from "@/features/snapshot/domain/themes";
import type { EmbeddedFonts } from "@/shared/lib/export/fonts";
import { escapeXml, fontFaces } from "@/shared/lib/svg";

import {
  DETAIL_SIZE,
  LABEL_SIZE,
  type Pipe,
  type PlanModel,
  type Room,
} from "./plan";

const SANS = "'Schibsted Grotesk', ui-sans-serif, sans-serif";
const MONO = "'Fragment Mono', ui-monospace, monospace";
const WALL_GAP = 4;
const ROOM_DIM = "0.3";
const PIPE_DIM = "0.15";

const n = (value: number) => Math.round(value * 100) / 100;

function grid(model: PlanModel, theme: SnapshotTheme): string {
  return (
    `<defs><pattern id="plan-grid" width="32" height="32" patternUnits="userSpaceOnUse">` +
    `<path d="M32 0H0V32" fill="none" stroke="${theme.text}" stroke-opacity="0.07"/>` +
    `</pattern></defs>` +
    `<rect width="${model.width}" height="${model.height}" fill="${theme.background}"/>` +
    `<rect width="${model.width}" height="${model.height}" fill="url(#plan-grid)"/>`
  );
}

function room(item: Room, theme: SnapshotTheme, dimmed: boolean): string {
  const opacity = dimmed ? ` opacity="${ROOM_DIM}"` : "";
  const inner =
    item.w > 2 * WALL_GAP && item.h > 2 * WALL_GAP
      ? `<rect x="${n(item.x + WALL_GAP)}" y="${n(item.y + WALL_GAP)}" width="${n(item.w - 2 * WALL_GAP)}" height="${n(item.h - 2 * WALL_GAP)}" fill="none" stroke="${theme.text}" stroke-opacity="0.45"/>`
      : "";
  const label = item.label
    ? `<text x="${n(item.x + 12)}" y="${n(item.y + 12 + LABEL_SIZE)}" font-family="${SANS}" font-weight="700" font-size="${LABEL_SIZE}" fill="${theme.text}">${escapeXml(item.label)}</text>`
    : "";
  const detail = item.detail
    ? `<text x="${n(item.x + 12)}" y="${n(item.y + 16 + LABEL_SIZE + DETAIL_SIZE)}" font-family="${MONO}" font-size="${DETAIL_SIZE}" fill="${theme.muted}">${escapeXml(item.detail)}</text>`
    : "";
  const callout =
    item.hotspot && item.h >= 80 && item.w >= 150
      ? `<text data-callout="" x="${n(item.x + 12)}" y="${n(item.y + item.h - 14)}" font-family="${SANS}" font-weight="700" font-size="${DETAIL_SIZE}" fill="${theme.accent}">${escapeXml(item.hotspot)}</text>`
      : "";

  return (
    `<g data-room="${escapeXml(item.id)}"${opacity}>` +
    `<rect x="${n(item.x)}" y="${n(item.y)}" width="${n(item.w)}" height="${n(item.h)}" fill="${theme.card}" fill-opacity="0.55" stroke="${item.hotspot ? theme.accent : theme.text}" stroke-width="2"/>` +
    inner +
    label +
    detail +
    callout +
    `</g>`
  );
}

function pipe(item: Pipe, theme: SnapshotTheme, dimmed: boolean): string {
  const opacity = dimmed ? ` opacity="${PIPE_DIM}"` : "";
  const { start, corner, end } = item;
  return (
    `<g data-pipe="${escapeXml(item.from)}>${escapeXml(item.to)}"${opacity}>` +
    `<path d="M${n(start.x)} ${n(start.y)}L${n(corner.x)} ${n(corner.y)}L${n(end.x)} ${n(end.y)}" fill="none" stroke="${theme.accent}" stroke-width="${n(item.width)}" stroke-linejoin="round"/>` +
    `<circle cx="${n(end.x)}" cy="${n(end.y)}" r="${n(item.width + 2)}" fill="${theme.accent}"/>` +
    `</g>`
  );
}

/** Draws a plan. With `selected`, that room and its pipes stay lit and the rest dims. */
export function renderPlan(
  model: PlanModel,
  theme: SnapshotTheme,
  options: { fonts?: EmbeddedFonts; selected?: string | null } = {},
): string {
  const { selected, fonts } = options;
  const linked = new Set(
    model.pipes.flatMap((p) =>
      p.from === selected || p.to === selected ? [p.from, p.to] : [],
    ),
  );

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${model.width}" height="${model.height}" viewBox="0 0 ${model.width} ${model.height}">` +
    `<style>${fonts ? fontFaces(fonts) : ""}</style>` +
    grid(model, theme) +
    model.rooms
      .map((r) =>
        room(r, theme, !!selected && r.id !== selected && !linked.has(r.id)),
      )
      .join("") +
    model.pipes
      .map((p) =>
        pipe(p, theme, !!selected && p.from !== selected && p.to !== selected),
      )
      .join("") +
    `<text data-title="" x="${model.title.x}" y="${model.title.y}" font-family="${SANS}" font-weight="700" font-size="${model.title.fontSize}" fill="${theme.text}">${escapeXml(model.title.text)}</text>` +
    `<text x="${model.title.x}" y="${model.factsY}" font-family="${SANS}" font-weight="700" font-size="15" fill="${theme.muted}" xml:space="preserve">${escapeXml(model.facts)}</text>` +
    `<text data-mark="" x="${model.mark.x}" y="${model.mark.y}" text-anchor="end" font-family="${SANS}" font-weight="700" font-size="15" fill="${theme.muted}">codeprint</text>` +
    `</svg>`
  );
}
