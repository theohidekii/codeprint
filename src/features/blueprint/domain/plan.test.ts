import { getSnapshotTheme } from "@/features/snapshot/domain/themes";

import type { Analysis } from "../server/analyze";
import { layoutPlan, type PlanModel, type PlanSize } from "./plan";
import { renderPlan } from "./render-plan";
import { squarify } from "./treemap";

const BOX = { x: 10, y: 20, w: 800, h: 500 };

describe("squarify", () => {
  it.each([
    ["equal rooms", Array<number>(24).fill(10)],
    ["one huge room", [99900, 50, 30, 20]],
    ["mixed", [500, 300, 200, 100, 60, 40, 30, 7]],
    ["a single room", [5]],
  ])("fills the box exactly with %s", (_, sizes) => {
    const rects = squarify(sizes, BOX);
    const total = sizes.reduce((a, b) => a + b, 0);

    expect(rects).toHaveLength(sizes.length);
    rects.forEach((r, i) => {
      expect(r.x).toBeGreaterThanOrEqual(BOX.x - 1e-6);
      expect(r.y).toBeGreaterThanOrEqual(BOX.y - 1e-6);
      expect(r.x + r.w).toBeLessThanOrEqual(BOX.x + BOX.w + 1e-6);
      expect(r.y + r.h).toBeLessThanOrEqual(BOX.y + BOX.h + 1e-6);
      const share = (r.w * r.h) / (BOX.w * BOX.h);
      expect(share).toBeCloseTo(sizes[i]! / total, 2);
      rects.slice(i + 1).forEach((o) => {
        const overlapX = Math.min(r.x + r.w, o.x + o.w) - Math.max(r.x, o.x);
        const overlapY = Math.min(r.y + r.h, o.y + o.h) - Math.max(r.y, o.y);
        expect(overlapX > 1e-6 && overlapY > 1e-6).toBe(false);
      });
    });
  });

  it("gives nothing for nothing, and survives zero sizes", () => {
    expect(squarify([], BOX)).toEqual([]);
    expect(squarify([0, 0], BOX)).toHaveLength(2);
  });

  it("is deterministic", () => {
    expect(squarify([3, 2, 1], BOX)).toEqual(squarify([3, 2, 1], BOX));
  });
});

const analysis = (overrides: Partial<Analysis> = {}): Analysis => ({
  repository: "acme/app",
  branch: "main",
  files: 40,
  truncated: false,
  modules: [
    { id: "src/core", name: "src/core", bytes: 50000, files: 20 },
    { id: "src/ui", name: "src/ui", bytes: 30000, files: 15 },
    { id: "tests", name: "tests", bytes: 5000, files: 5 },
  ],
  edges: [
    { from: "src/ui", to: "src/core", weight: 8 },
    { from: "tests", to: "src/core", weight: 1 },
  ],
  hotspots: [{ moduleId: "src/core", reason: "largest" }],
  unreadLanguages: [],
  sampled: false,
  topLanguage: "TypeScript",
  ...overrides,
});

const layout = (
  a: Analysis = analysis(),
  size: PlanSize = "landscape",
): PlanModel => layoutPlan(a, { size });

const theme = getSnapshotTheme("cyanotype");
const parse = (svg: string) =>
  new DOMParser().parseFromString(svg, "image/svg+xml");

describe("layoutPlan", () => {
  it.each<[PlanSize, number, number]>([
    ["landscape", 1600, 1000],
    ["square", 1080, 1080],
    ["linkedin", 1200, 627],
  ])("sizes a %s plan", (size, width, height) => {
    expect(layout(analysis(), size)).toMatchObject({ width, height });
  });

  it("numbers rooms and labels the ones with room for it", () => {
    const { rooms } = layout();

    expect(rooms.map((r) => r.number)).toEqual([1, 2, 3]);
    expect(rooms[0]).toMatchObject({
      id: "src/core",
      label: "src/core",
      detail: "48.8 KB, 20 files",
      hotspot: "largest",
    });
  });

  it("shortens long names, and falls back to the number in tiny rooms", () => {
    const { rooms } = layout(
      analysis({
        modules: [
          { id: "a", name: "a", bytes: 1_000_000, files: 1 },
          { id: "long", name: "n".repeat(300), bytes: 300_000, files: 1 },
          { id: "tiny", name: "tiny-room-name", bytes: 1, files: 1 },
        ],
        edges: [],
        hotspots: [],
      }),
    );

    expect(rooms[1]!.label!.endsWith("…")).toBe(true);
    expect(rooms[2]!.label).toBe("3");
  });

  it("keeps even the smallest room big enough to see", () => {
    const { rooms } = layout(
      analysis({
        modules: [
          { id: "a", name: "a", bytes: 10_000_000, files: 1 },
          { id: "b", name: "b", bytes: 1, files: 1 },
        ],
        edges: [],
        hotspots: [],
      }),
    );

    expect(rooms[1]!.w).toBeGreaterThan(8);
    expect(rooms[1]!.h).toBeGreaterThan(8);
  });

  it("joins rooms with pipes that start and end on their walls, thicker with weight", () => {
    const { pipes, rooms } = layout();
    const onWall = (p: { x: number; y: number }, id: string) => {
      const r = rooms.find((room) => room.id === id)!;
      const inside =
        p.x >= r.x - 0.01 &&
        p.x <= r.x + r.w + 0.01 &&
        p.y >= r.y - 0.01 &&
        p.y <= r.y + r.h + 0.01;
      const edge =
        Math.abs(p.x - r.x) < 0.01 ||
        Math.abs(p.x - r.x - r.w) < 0.01 ||
        Math.abs(p.y - r.y) < 0.01 ||
        Math.abs(p.y - r.y - r.h) < 0.01;
      return inside && edge;
    };

    expect(pipes).toHaveLength(2);
    for (const pipe of pipes) {
      expect(onWall(pipe.start, pipe.from)).toBe(true);
      expect(onWall(pipe.end, pipe.to)).toBe(true);
    }
    expect(pipes[0]!.width).toBeGreaterThan(pipes[1]!.width);
  });

  it("states the facts in the title block", () => {
    const model = layout();

    expect(model.title.text).toBe("acme/app");
    expect(model.facts).toBe("3 modules     40 files     TypeScript");
  });

  it("shortens a very long repository name", () => {
    const { title } = layout(analysis({ repository: "o/" + "r".repeat(120) }));

    expect(title.text.endsWith("…")).toBe(true);
  });

  it("is deterministic and handles a repository with no modules", () => {
    expect(layout()).toEqual(layout());
    expect(
      layout(analysis({ modules: [], edges: [], hotspots: [] })).rooms,
    ).toEqual([]);
  });
});

describe("renderPlan", () => {
  it("produces a well-formed, repeatable svg", () => {
    const svg = renderPlan(layout(), theme);

    expect(parse(svg).querySelector("parsererror")).toBeNull();
    expect(svg).toBe(renderPlan(layout(), theme));
  });

  it("draws a room per module and a pipe per edge", () => {
    const doc = parse(renderPlan(layout(), theme));

    expect(doc.querySelectorAll("[data-room]")).toHaveLength(3);
    expect(doc.querySelectorAll("[data-pipe]")).toHaveLength(2);
    expect(doc.querySelector("[data-callout]")!.textContent).toBe("largest");
    expect(doc.querySelector("[data-mark]")!.textContent).toBe("codeprint");
  });

  it("renders hostile names as text", () => {
    const evil = "<script>x</script>&";
    const doc = parse(
      renderPlan(
        layout(
          analysis({
            repository: evil,
            modules: [{ id: evil, name: evil, bytes: 10, files: 1 }],
            edges: [],
            hotspots: [],
          }),
        ),
        theme,
      ),
    );

    expect(doc.querySelector("parsererror")).toBeNull();
    expect(doc.querySelectorAll("script")).toHaveLength(0);
  });

  it("highlights a selected room and its pipes, and dims the rest", () => {
    const doc = parse(renderPlan(layout(), theme, { selected: "tests" }));
    const opacity = (selector: string) =>
      doc.querySelector(selector)!.getAttribute("opacity");

    expect(opacity('[data-room="tests"]')).toBeNull();
    expect(opacity('[data-room="src/ui"]')).toBe("0.3");
    expect(opacity('[data-pipe="tests>src/core"]')).toBeNull();
    expect(opacity('[data-pipe="src/ui>src/core"]')).toBe("0.15");
  });

  it("embeds fonts when given", () => {
    const svg = renderPlan(layout(), theme, {
      fonts: { mono: "data:,a", sans: "data:,b" },
    });

    expect(svg.match(/@font-face/g)).toHaveLength(2);
  });
});
