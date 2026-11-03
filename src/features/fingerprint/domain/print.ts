import { seededRandom } from "./random";
import type { Traits } from "./traits";

export interface PrintRidge {
  id: string;
  d: string;
  /** Index into traits.bands, or -1 when no language colors it. */
  band: number;
}

/** Ridges stay within ±x, ±y. The poster clips them to a fingertip outline inside this box. */
export const PRINT_BOX = { x: 170, y: 210 } as const;

type Point = readonly [x: number, y: number];

const X_STEP = 8;
const ANGLE_STEP = 0.07;
const WHORL_SQUASH = 0.82;
const WHORL_OPENING = 0.14;
const GOLDEN_ANGLE = 2.399963;
const LOOP_STRETCH = 1.08;
const ARCH_HEIGHT = 74;
const ARCH_WIDTH = 92;

const clamp = (value: number, limit: number) =>
  Math.max(-limit, Math.min(limit, value));

function format(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return (Object.is(rounded, -0) ? 0 : rounded).toString();
}

function toPath(points: readonly Point[]): string {
  const clamped = points.map(
    ([x, y]) =>
      `${format(clamp(x, PRINT_BOX.x))},${format(clamp(y, PRINT_BOX.y))}`,
  );
  return `M${clamped.join(" L")}`;
}

/** Share of the ridges per band: proportional, and at least one each, summing to `total`. */
function bandCounts(shares: readonly number[], total: number): number[] {
  const counts = shares.map((share) => Math.max(1, Math.floor(share * total)));
  let assigned = counts.reduce((sum, n) => sum + n, 0);

  // Too many: take from the largest band. Too few: give to the largest remainder.
  while (assigned > total) {
    counts[counts.indexOf(Math.max(...counts))]!--;
    assigned--;
  }
  const remainders = shares
    .map((share, band) => ({
      band,
      rest: share * total - Math.floor(share * total),
    }))
    .sort((a, b) => b.rest - a.rest);
  for (let i = 0; assigned < total; i++, assigned++) {
    counts[remainders[i % remainders.length]!.band]!++;
  }
  return counts;
}

/** Band per ridge, innermost first: the main language sits at the heart of the print. */
function assignBands(traits: Traits): number[] {
  if (traits.bands.length === 0)
    return Array<number>(traits.ridgeCount).fill(-1);
  return bandCounts(
    traits.bands.map((b) => b.share),
    traits.ridgeCount,
  ).flatMap((count, band) => Array<number>(count).fill(band));
}

/** Ridges that enter from one side, recurve around the core and leave on the same side. */
function loop(
  i: number,
  gap: number,
  shake: (t: number) => number,
  traits: Traits,
  side: number,
): Point[] {
  const { x: cx, y: cy } = traits.core;
  const r = (i + 1) * gap;
  const points: Point[] = [];
  // `along` runs the whole length of the ridge, so the wobble has no seam where lines meet.
  let along = 0;
  for (let d = PRINT_BOX.x * 2; d >= 0; d -= X_STEP) {
    points.push([cx + side * d, cy + r + shake(along)]);
    along += X_STEP;
  }
  for (let a = Math.PI / 2; a >= -Math.PI / 2; a -= ANGLE_STEP) {
    const radius = r + shake(along);
    points.push([
      cx - side * Math.cos(a) * radius * LOOP_STRETCH,
      cy + Math.sin(a) * radius,
    ]);
    along += ANGLE_STEP * r;
  }
  for (let d = 0; d <= PRINT_BOX.x * 2; d += X_STEP) {
    points.push([cx + side * d, cy - r - shake(along)]);
    along += X_STEP;
  }
  return points;
}

/** Nested, almost closed rings around the core. */
function whorl(
  i: number,
  gap: number,
  shake: (t: number) => number,
  traits: Traits,
  start: number,
): Point[] {
  const { x: cx, y: cy } = traits.core;
  const points: Point[] = [];
  // Each ring opens somewhere else: lined-up openings would cut a wedge out of the print.
  const rotation = start + i * GOLDEN_ANGLE;
  for (
    let a = WHORL_OPENING;
    a <= Math.PI * 2 - WHORL_OPENING;
    a += ANGLE_STEP
  ) {
    // A slight spiral, so rings read as one ridge rather than as a target.
    const base = (i + 1 + a / (Math.PI * 2)) * gap;
    const r = base + shake(a * base);
    const angle = a + rotation;
    points.push([
      cx + Math.cos(angle) * r * WHORL_SQUASH,
      cy + Math.sin(angle) * r,
    ]);
  }
  return points;
}

/** Ridges that sweep across, rising over the core. */
function arch(
  i: number,
  total: number,
  shake: (t: number) => number,
  traits: Traits,
): Point[] {
  const { x: cx, y: cy } = traits.core;
  const level = total > 1 ? i / (total - 1) : 0.5;
  const y0 = -PRINT_BOX.y * 0.92 + level * PRINT_BOX.y * 2 * 0.92;
  // The rise fades toward the top and bottom edges of the print.
  const rise = ARCH_HEIGHT * Math.sin(level * Math.PI);
  const points: Point[] = [];
  for (let x = -PRINT_BOX.x; x <= PRINT_BOX.x; x += X_STEP) {
    const bump = rise * Math.exp(-(((x - cx) / ARCH_WIDTH) ** 2));
    points.push([x, y0 + cy * 0.4 - bump + shake(x)]);
  }
  return points;
}

/** Draws the ridges of a print. Same traits, same ridges. */
export function buildPrint(traits: Traits): PrintRidge[] {
  const random = seededRandom(`${traits.seed}:print`);
  const side = random() < 0.5 ? -1 : 1;
  const start = random() * Math.PI * 2;
  const bands = assignBands(traits);
  const gap = (PRINT_BOX.y * 0.95) / (traits.ridgeCount + 1);

  return bands.map((band, i) => {
    const frequency = 0.02 + random() * 0.03;
    const phase = random() * Math.PI * 2;
    const shake = (t: number) =>
      traits.wobble *
      (Math.sin(t * frequency + phase) +
        0.5 * Math.sin(t * frequency * 2.3 - phase));

    const points =
      traits.pattern === "loop"
        ? loop(i, gap, shake, traits, side)
        : traits.pattern === "whorl"
          ? whorl(i, gap, shake, traits, start)
          : arch(i, traits.ridgeCount, shake, traits);

    return { id: `print-${i}`, d: toPath(points), band };
  });
}
