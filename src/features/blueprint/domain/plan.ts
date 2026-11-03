import type { Analysis } from "../server/analyze";
import type { HotspotReason } from "./edges";
import { type Rect, squarify } from "./treemap";

export type PlanSize = "landscape" | "square" | "linkedin";

export interface Room extends Rect {
  id: string;
  number: number;
  /** The name, shortened to fit, or just the number in tiny rooms. */
  label: string | null;
  detail: string | null;
  hotspot: HotspotReason | null;
}

interface Point {
  x: number;
  y: number;
}

export interface Pipe {
  from: string;
  to: string;
  start: Point;
  corner: Point;
  end: Point;
  width: number;
}

export interface PlanModel {
  width: number;
  height: number;
  box: Rect;
  rooms: Room[];
  pipes: Pipe[];
  title: { text: string; x: number; y: number; fontSize: number };
  facts: string;
  factsY: number;
  mark: Point;
}

const SIZES: Record<
  PlanSize,
  { width: number; height: number; margin: number }
> = {
  landscape: { width: 1600, height: 1000, margin: 40 },
  square: { width: 1080, height: 1080, margin: 36 },
  linkedin: { width: 1200, height: 627, margin: 28 },
};

export const LABEL_SIZE = 14;
export const DETAIL_SIZE = 12;
const TITLE_SIZE = 28;
const TITLE_BLOCK = 84;
const CHAR_RATIO = 0.6;
const ROOM_PADDING = 10;
/** No room drops below this share of the plan, or it couldn't be seen or clicked. */
const MIN_SHARE = 0.006;
const ELLIPSIS = "…";

function shorten(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, Math.max(1, maxChars - 1)) + ELLIPSIS;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Where the line from a room's centre towards a point crosses its wall. */
function wallPoint(room: Rect, toward: Point): Point {
  const cx = room.x + room.w / 2;
  const cy = room.y + room.h / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: room.y };
  const scale = Math.min(
    dx === 0 ? Infinity : room.w / 2 / Math.abs(dx),
    dy === 0 ? Infinity : room.h / 2 / Math.abs(dy),
  );
  return { x: cx + dx * scale, y: cy + dy * scale };
}

const centre = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** Places rooms, pipes and the title block. Same analysis, same plan. */
export function layoutPlan(
  analysis: Analysis,
  options: { size: PlanSize },
): PlanModel {
  const { width, height, margin } = SIZES[options.size];
  const box = {
    x: margin,
    y: margin,
    w: width - 2 * margin,
    h: height - 2 * margin - TITLE_BLOCK,
  };

  const total = analysis.modules.reduce((sum, m) => sum + m.bytes, 0);
  const sizes = analysis.modules.map((m) =>
    Math.max(m.bytes, total * MIN_SHARE),
  );
  const rects = squarify(sizes, box);
  const hotspots = new Map(
    analysis.hotspots.map((h) => [h.moduleId, h.reason]),
  );

  const rooms: Room[] = analysis.modules.map((module_, i) => {
    const rect = rects[i]!;
    const fit = Math.floor(
      (rect.w - 2 * ROOM_PADDING) / (LABEL_SIZE * CHAR_RATIO),
    );
    const roomy = fit >= 6 && rect.h >= LABEL_SIZE + 2 * ROOM_PADDING;
    const detail = `${formatBytes(module_.bytes)}, ${module_.files} ${module_.files === 1 ? "file" : "files"}`;
    return {
      ...rect,
      id: module_.id,
      number: i + 1,
      label: roomy ? shorten(module_.name, fit) : String(i + 1),
      detail: roomy && rect.h >= 56 && detail.length <= fit + 2 ? detail : null,
      hotspot: hotspots.get(module_.id) ?? null,
    };
  });

  const byId = new Map(rooms.map((room) => [room.id, room]));
  const heaviest = Math.max(1, ...analysis.edges.map((e) => e.weight));
  const pipes: Pipe[] = analysis.edges.flatMap((edge) => {
    const a = byId.get(edge.from);
    const b = byId.get(edge.to);
    if (!a || !b) return [];
    const start = wallPoint(a, centre(b));
    const end = wallPoint(b, centre(a));
    return [
      {
        from: edge.from,
        to: edge.to,
        start,
        corner: { x: end.x, y: start.y },
        end,
        width: 1.5 + 4.5 * Math.sqrt(edge.weight / heaviest),
      },
    ];
  });

  const titleWidth = (width - 2 * margin) * 0.75;
  const language = analysis.topLanguage ? `     ${analysis.topLanguage}` : "";
  return {
    width,
    height,
    box,
    rooms,
    pipes,
    title: {
      text: shorten(
        analysis.repository,
        Math.floor(titleWidth / (TITLE_SIZE * CHAR_RATIO)),
      ),
      x: margin,
      y: height - margin - 36,
      fontSize: TITLE_SIZE,
    },
    facts: `${analysis.modules.length} modules     ${analysis.files} files${language}`,
    factsY: height - margin - 6,
    mark: { x: width - margin, y: height - margin - 6 },
  };
}
