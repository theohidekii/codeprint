import type { Module } from "./modules";

export interface Edge {
  /** The main direction of the dependency. */
  from: string;
  to: string;
  weight: number;
}

export type HotspotReason =
  "largest" | "most connected" | "large and connected";

export interface Hotspot {
  moduleId: string;
  reason: HotspotReason;
}

const MAX_EDGES = 40;
const MAX_HOTSPOTS = 3;

/** Turns file-level imports into one weighted pipe per pair of modules. */
export function buildEdges(
  imports: readonly { path: string; targets: readonly string[] }[],
  modules: readonly Module[],
): Edge[] {
  const owner = new Map<string, string>();
  for (const room of modules) {
    for (const path of room.paths) owner.set(path, room.id);
  }

  const directed = new Map<string, Map<string, number>>();
  for (const { path, targets } of imports) {
    const from = owner.get(path);
    if (!from) continue;
    for (const target of targets) {
      const to = owner.get(target);
      if (!to || to === from) continue;
      const row = directed.get(from) ?? new Map<string, number>();
      row.set(to, (row.get(to) ?? 0) + 1);
      directed.set(from, row);
    }
  }

  const edges: Edge[] = [];
  const seen = new Set<string>();
  for (const [from, row] of directed) {
    for (const [to, count] of row) {
      const key = from < to ? `${from}\n${to}` : `${to}\n${from}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const back = directed.get(to)?.get(from) ?? 0;
      edges.push(
        count > back || (count === back && from < to)
          ? { from, to, weight: count + back }
          : { from: to, to: from, weight: count + back },
      );
    }
  }
  return edges
    .sort(
      (a, b) =>
        b.weight - a.weight ||
        a.from.localeCompare(b.from) ||
        a.to.localeCompare(b.to),
    )
    .slice(0, MAX_EDGES);
}

/** The rooms worth a callout, each with the true reason it stands out. */
export function pickHotspots(
  modules: readonly Module[],
  edges: readonly Edge[],
): Hotspot[] {
  if (modules.length === 0) return [];
  const connections = new Map<string, number>();
  for (const { from, to } of edges) {
    connections.set(from, (connections.get(from) ?? 0) + 1);
    connections.set(to, (connections.get(to) ?? 0) + 1);
  }
  const links = (m: Module) => connections.get(m.id) ?? 0;

  const largest = modules.reduce((a, b) => (b.bytes > a.bytes ? b : a));
  const hotspots: Hotspot[] = [{ moduleId: largest.id, reason: "largest" }];

  const hub = modules.reduce((a, b) => (links(b) > links(a) ? b : a));
  if (links(hub) > 0 && hub !== largest) {
    hotspots.push({ moduleId: hub.id, reason: "most connected" });
  }

  const third = modules
    .filter((m) => links(m) > 0 && !hotspots.some((h) => h.moduleId === m.id))
    .sort((a, b) => b.bytes * links(b) - a.bytes * links(a))[0];
  if (third && hotspots.length < MAX_HOTSPOTS) {
    hotspots.push({ moduleId: third.id, reason: "large and connected" });
  }
  return hotspots;
}
