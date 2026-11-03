import { getSnapshotTheme } from "@/features/snapshot/domain/themes";

import { POSTER_THEMES, bandColor } from "./palettes";
import { layoutPoster, type PosterOptions, type PosterSize } from "./poster";
import type { Profile } from "./profile";
import { renderPoster } from "./render-poster";
import { deriveTraits } from "./traits";

const profile = (overrides: Partial<Profile> = {}): Profile => ({
  kind: "user",
  name: "octocat",
  languages: [
    { name: "TypeScript", share: 0.68 },
    { name: "Go", share: 0.32 },
  ],
  hours: Array<number>(24)
    .fill(0)
    .map((_, i) => (i === 14 ? 10 : i === 3 ? 5 : 0)),
  weekdays: [1, 2, 3, 4, 3, 2, 1],
  sizes: { count: 40, median: 200 },
  stars: 12400,
  sampled: 15,
  ...overrides,
});

const layout = (p: Profile = profile(), options: Partial<PosterOptions> = {}) =>
  layoutPoster(p, deriveTraits(p), {
    theme: "latent-dark",
    size: "portrait",
    ...options,
  });

function render(
  p: Profile = profile(),
  fonts?: { mono: string; sans: string },
) {
  return renderPoster(layout(p), getSnapshotTheme("latent-dark"), fonts);
}

const parse = (svg: string) =>
  new DOMParser().parseFromString(svg, "image/svg+xml");

function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe("palettes", () => {
  it("offers the four poster themes", () => {
    expect(POSTER_THEMES).toEqual([
      "latent-dark",
      "latent-light",
      "cyanotype",
      "paper",
    ]);
  });

  it.each(POSTER_THEMES)("keeps %s band colors visible (3:1)", (id) => {
    const { background } = getSnapshotTheme(id);
    for (let band = 0; band < 6; band++) {
      const color = bandColor(id, band);
      expect(
        contrast(color, background),
        `${id}: band ${band} ${color} on ${background}`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("uses the accent for ridges with no language", () => {
    expect(bandColor("paper", -1)).toBe(getSnapshotTheme("paper").accent);
  });
});

describe("layoutPoster", () => {
  it.each<[PosterSize, number, number]>([
    ["portrait", 1080, 1350],
    ["square", 1080, 1080],
    ["landscape", 1200, 627],
  ])("sizes a %s poster", (size, width, height) => {
    expect(layout(profile(), { size })).toMatchObject({ width, height });
  });

  it("draws 24 ring ticks in proportion to activity", () => {
    const { ring } = layout();

    expect(ring).toHaveLength(24);
    expect(ring[14]!.length).toBeGreaterThan(0);
    expect(ring[3]!.length).toBeCloseTo(ring[14]!.length / 2);
    expect(ring[0]!.length).toBe(0);
  });

  it("states the facts", () => {
    expect(layout().facts).toEqual([
      "12.4K stars",
      "TypeScript 68%",
      "peak 14:00 UTC",
    ]);
  });

  it("leaves out facts it doesn't have", () => {
    const quiet = layout(
      profile({
        stars: 0,
        languages: [],
        hours: Array<number>(24).fill(0),
        sampled: 0,
      }),
    );

    expect(quiet.facts).toEqual([]);
    expect(quiet.note).toBe("Not much public activity yet.");
    expect(layout().note).toBeNull();
  });

  it("shrinks long names to fit", () => {
    const short = layout(profile({ name: "ana" }));
    const long = layout(profile({ name: "n".repeat(60) }));

    expect(long.title.fontSize).toBeLessThan(short.title.fontSize);
    expect(
      long.title.text.length * long.title.fontSize * 0.6,
    ).toBeLessThanOrEqual(1080 - 2 * long.title.x);
  });

  it("cuts a name too long even for the smallest size", () => {
    const { title } = layout(profile({ name: "n".repeat(140) }), {
      size: "landscape",
    });

    expect(title.text.endsWith("…")).toBe(true);
  });

  it("keeps the print and text inside the poster", () => {
    for (const size of ["portrait", "square", "landscape"] as const) {
      const model = layout(profile(), { size });

      expect(model.print.scale).toBeGreaterThan(0);
      expect(model.print.cx + 240 * model.print.scale).toBeLessThanOrEqual(
        model.width,
      );
      expect(model.print.cy + 240 * model.print.scale).toBeLessThanOrEqual(
        model.height,
      );
      expect(model.print.cy - 240 * model.print.scale).toBeGreaterThanOrEqual(
        0,
      );
      for (const item of model.legend) {
        expect(item.y).toBeLessThanOrEqual(model.height);
      }
    }
  });

  it("lists languages with their colors", () => {
    expect(layout().legend.map((l) => [l.name, l.percent, l.color])).toEqual([
      ["TypeScript", 68, bandColor("latent-dark", 0)],
      ["Go", 32, bandColor("latent-dark", 1)],
    ]);
  });
});

describe("renderPoster", () => {
  it("produces a well-formed svg", () => {
    const doc = parse(render());

    expect(doc.querySelector("parsererror")).toBeNull();
    expect(doc.documentElement.getAttribute("width")).toBe("1080");
    expect(doc.documentElement.getAttribute("height")).toBe("1350");
  });

  it("is byte-identical across runs, and differs between names", () => {
    expect(render()).toBe(render());
    expect(render(profile({ name: "someone-else" }))).not.toBe(render());
  });

  it("colors ridges by language and draws the ring", () => {
    const doc = parse(render());
    const strokes = [...doc.querySelectorAll("path[data-ridge]")].map((p) =>
      p.getAttribute("stroke"),
    );

    expect(new Set(strokes)).toEqual(
      new Set([bandColor("latent-dark", 0), bandColor("latent-dark", 1)]),
    );
    expect(doc.querySelectorAll("line[data-tick]")).toHaveLength(24);
  });

  it("renders hostile GitHub data as text, never as markup", () => {
    const evil = '<script>alert(1)</script>&"';
    const doc = parse(
      render(
        profile({
          name: evil,
          languages: [{ name: evil, share: 1 }],
        }),
      ),
    );

    expect(doc.querySelector("parsererror")).toBeNull();
    expect(doc.querySelectorAll("script")).toHaveLength(0);
    expect(doc.querySelector("[data-title]")!.textContent).toContain(
      "<script>",
    );
  });

  it("survives unpaired surrogates", () => {
    expect(() =>
      encodeURIComponent(render(profile({ name: "a\uD800b" }))),
    ).not.toThrow();
  });

  it("embeds fonts when given, and sets the title in the sans font", () => {
    const doc = parse(
      render(profile(), {
        mono: "data:font/woff2;base64,AAA",
        sans: "data:font/woff2;base64,BBB",
      }),
    );

    expect(
      doc.querySelector("style")!.textContent!.match(/@font-face/g),
    ).toHaveLength(2);
    expect(
      doc.querySelector("[data-title]")!.getAttribute("font-family"),
    ).toContain("Schibsted Grotesk");
  });

  it("signs the poster", () => {
    expect(parse(render()).querySelector("[data-mark]")!.textContent).toBe(
      "codeprint",
    );
  });
});
