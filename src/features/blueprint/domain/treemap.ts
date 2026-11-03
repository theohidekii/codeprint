export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The worst width-to-height ratio of a row laid along a side of the given length. */
function worstRatio(areas: readonly number[], side: number): number {
  const sum = areas.reduce((a, b) => a + b, 0);
  const max = Math.max(...areas);
  const min = Math.min(...areas);
  return Math.max(
    (side * side * max) / (sum * sum),
    (sum * sum) / (side * side * min),
  );
}

/**
 * Squarified treemap (Bruls, Huizing and van Wijk, 2000): rooms proportional to `sizes`, as close
 * to square as possible. Results keep the input order. Sizes should be sorted descending.
 */
export function squarify(sizes: readonly number[], box: Rect): Rect[] {
  if (sizes.length === 0) return [];
  const total = sizes.reduce((a, b) => a + b, 0);
  const scale = total > 0 ? (box.w * box.h) / total : 0;
  const fallback = (box.w * box.h) / sizes.length;
  const areas = sizes.map((size) => (total > 0 ? size * scale : fallback));

  const rects: Rect[] = [];
  let free = { ...box };
  let i = 0;
  while (i < areas.length) {
    const side = Math.min(free.w, free.h);
    const row: number[] = [areas[i]!];
    let next = i + 1;
    while (
      next < areas.length &&
      areas[next]! > 0 &&
      worstRatio([...row, areas[next]!], side) <= worstRatio(row, side)
    ) {
      row.push(areas[next]!);
      next++;
    }

    const rowArea = row.reduce((a, b) => a + b, 0);
    const horizontal = free.w >= free.h;
    const thickness = side > 0 ? rowArea / side : 0;
    let offset = 0;
    for (const area of row) {
      const length = thickness > 0 ? area / thickness : 0;
      rects.push(
        horizontal
          ? { x: free.x, y: free.y + offset, w: thickness, h: length }
          : { x: free.x + offset, y: free.y, w: length, h: thickness },
      );
      offset += length;
    }
    free = horizontal
      ? { ...free, x: free.x + thickness, w: free.w - thickness }
      : { ...free, y: free.y + thickness, h: free.h - thickness };
    i = next;
  }
  return rects;
}
