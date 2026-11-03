export interface Ridge {
  id: string;
  d: string;
}

type Point = readonly [x: number, y: number];

/** Center of the loop the ridges recurve around, in the print's SVG coordinates. */
export const PRINT_CORE = { x: 30, y: 6 } as const;

const LOOPS = 12;
const ARCHES = 9;
const SPACING = 8.4;
const LEFT = -170;
const RIGHT = 170;

/** Small, deterministic irregularity so ridges look organic rather than machined. */
function wobble(x: number, seed: number): number {
  return 2.2 * Math.sin(x / 23 + seed * 1.3) + 1.1 * Math.sin(x / 9 - seed);
}

function loop(i: number): Point[] {
  const { x: cx, y: cy } = PRINT_CORE;
  const r = 7 + i * SPACING;
  const points: Point[] = [];
  // Enter from the left below the core...
  for (let x = LEFT; x <= cx; x += 4) points.push([x, cy + r + wobble(x, i)]);
  // ...recurve around its right side...
  for (let a = Math.PI / 2; a >= -Math.PI / 2; a -= 0.06) {
    points.push([cx + Math.cos(a) * r * 1.08, cy + Math.sin(a) * r]);
  }
  // ...and leave to the left above it, drifting up slightly.
  for (let x = cx; x >= LEFT; x -= 4) {
    points.push([x, cy - r + wobble(x, i + 5) - ((cx - x) / 120) ** 2 * 6]);
  }
  return points;
}

function arches(j: number): [over: Point[], under: Point[]] {
  const lift = 7 + LOOPS * SPACING + j * SPACING;
  const over: Point[] = [];
  const under: Point[] = [];
  for (let x = LEFT; x <= RIGHT; x += 4) {
    const bow = (x / RIGHT) ** 2 * (18 + j * 3);
    over.push([x, PRINT_CORE.y - lift + bow + wobble(x, j + 20)]);
    under.unshift([x, PRINT_CORE.y + lift - bow * 0.6 + wobble(x, j + 40)]);
  }
  return [over, under];
}

function toPath(points: Point[]): string {
  return "M" + points.map(([x, y]) => `${round(x)},${round(y)}`).join(" L");
}

function round(n: number): string {
  // Avoid "-0" so the output is stable and readable.
  const value = Math.round(n * 10) / 10;
  return (Object.is(value, -0) ? 0 : value).toString();
}

/**
 * Geometry for a loop-pattern fingerprint: ridges that enter from the left, recurve around the
 * core and exit left again, framed by arches above and below.
 */
export function buildRidges(): Ridge[] {
  const paths: Point[][] = [];
  for (let i = 0; i < LOOPS; i++) paths.push(loop(i));
  for (let j = 0; j < ARCHES; j++) paths.push(...arches(j));
  return paths.map((points, i) => ({ id: `ridge-${i}`, d: toPath(points) }));
}
