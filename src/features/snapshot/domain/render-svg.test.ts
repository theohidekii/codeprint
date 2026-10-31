import { type ColoredLine, layoutSnapshot } from "./layout";
import { DEFAULT_OPTIONS, type SnapshotOptions } from "./options";
import { renderSvg } from "./render-svg";
import { getSnapshotTheme } from "./themes";

const theme = getSnapshotTheme("latent-dark");

function render(
  lines: ColoredLine[],
  patch: Partial<SnapshotOptions> = {},
  fonts?: { mono: string; sans: string },
) {
  const options = { ...DEFAULT_OPTIONS, ...patch };
  const model = layoutSnapshot(lines, options, "JavaScript");
  const svg = renderSvg(model, theme, {
    background: options.background,
    fonts,
  });
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  return { svg, doc, model };
}

const sample: ColoredLine[] = [
  [
    { text: "const", color: "#c08be6" },
    { text: " a ", color: "#eceaf4" },
    { text: "=", color: "#eceaf4" },
  ],
  [{ text: "run();", color: "#8cc8ff" }],
  [{ text: "done", color: "#eceaf4" }],
];

describe("renderSvg", () => {
  it("produces a well-formed svg sized like the model", () => {
    const { doc, model } = render(sample);
    const root = doc.documentElement;

    expect(doc.querySelector("parsererror")).toBeNull();
    expect(root.tagName).toBe("svg");
    expect(Number(root.getAttribute("width"))).toBeCloseTo(model.width);
    expect(Number(root.getAttribute("height"))).toBeCloseTo(model.height);
    expect(root.getAttribute("viewBox")).toBe(
      `0 0 ${model.width} ${model.height}`,
    );
  });

  it("draws each line as one text element with a colored tspan per token", () => {
    const { doc } = render(sample);
    const lines = doc.querySelectorAll("text[data-line]");

    expect(lines).toHaveLength(3);
    const spans = [...lines[0]!.querySelectorAll("tspan")];
    expect(spans.map((s) => s.textContent)).toEqual(["const", " a ", "="]);
    expect(spans.map((s) => s.getAttribute("fill"))).toEqual([
      "#c08be6",
      "#eceaf4",
      "#eceaf4",
    ]);
  });

  it("dims other lines and washes the highlighted one", () => {
    const { doc } = render(sample, { highlighted: [2] });

    expect(
      doc.querySelector('text[data-line="1"]')!.getAttribute("opacity"),
    ).toBe("0.45");
    expect(
      doc.querySelector('text[data-line="2"]')!.getAttribute("opacity"),
    ).toBeNull();
    const wash = doc.querySelectorAll('rect[data-highlight="2"]');
    expect(wash).toHaveLength(1);
    expect(wash[0]!.getAttribute("fill")).toBe(theme.highlight);
  });

  it("renders hostile code as text, never as markup", () => {
    const hostile = "<script>alert(1)</script> &amp; ]]> \" ' </svg><g>";
    const { doc } = render([[{ text: hostile, color: "#fff" }]], {
      title: "<b>t</b>",
      caption: "</text><script>",
    });

    expect(doc.querySelector("parsererror")).toBeNull();
    expect(doc.querySelectorAll("script")).toHaveLength(0);
    expect(doc.querySelectorAll("svg")).toHaveLength(1);
    expect(doc.querySelector('text[data-line="1"]')!.textContent).toBe(hostile);
    expect(doc.querySelector("[data-title]")!.textContent).toBe("<b>t</b>");
    expect(doc.querySelector("[data-caption]")!.textContent).toBe(
      "</text><script>",
    );
  });

  it("drops control characters that XML cannot hold", () => {
    const { doc } = render([[{ text: "a\u0001b\u0000c", color: "#fff" }]]);

    expect(doc.querySelector("parsererror")).toBeNull();
    expect(doc.querySelector('text[data-line="1"]')!.textContent).toBe("abc");
  });

  it.each([
    ["solid", 1, 0],
    ["ridges", 1, 1],
    ["none", 0, 0],
  ] as const)("draws a %s background", (background, rects, ridges) => {
    const { doc } = render(sample, { background });

    expect(doc.querySelectorAll("[data-background]")).toHaveLength(rects);
    expect(doc.querySelectorAll("[data-ridges]")).toHaveLength(ridges);
    if (rects) {
      expect(doc.querySelector("[data-background]")!.getAttribute("fill")).toBe(
        theme.background,
      );
    }
  });

  it("draws the window bar with three dots and the title", () => {
    const { doc } = render(sample, { title: "debounce.js" });

    expect(doc.querySelectorAll("circle[data-dot]")).toHaveLength(3);
    expect(doc.querySelector("[data-title]")!.textContent).toBe("debounce.js");
  });

  it("omits the bar for the minimal frame", () => {
    const { doc } = render(sample, { frame: "minimal" });

    expect(doc.querySelector("[data-title]")).toBeNull();
    expect(doc.querySelectorAll("circle[data-dot]")).toHaveLength(0);
  });

  it("numbers lines when asked", () => {
    expect(render(sample).doc.querySelectorAll("[data-number]")).toHaveLength(
      3,
    );
    expect(
      render(sample, { lineNumbers: false }).doc.querySelectorAll(
        "[data-number]",
      ),
    ).toHaveLength(0);
  });

  it("embeds fonts when given", () => {
    const { doc } = render(
      sample,
      {},
      {
        mono: "data:font/woff2;base64,AAA",
        sans: "data:font/woff2;base64,BBB",
      },
    );
    const css = doc.querySelector("style")!.textContent!;

    expect(css.match(/@font-face/g)).toHaveLength(2);
    expect(css).toContain("data:font/woff2;base64,AAA");
    expect(css).toContain("data:font/woff2;base64,BBB");
  });

  it("scales the card for fixed sizes", () => {
    const big = Array.from({ length: 60 }, () => [
      { text: "y".repeat(100), color: "#fff" },
    ]);
    const { doc, model } = render(big, { size: "linkedin" });

    expect(doc.querySelector("[data-card]")!.getAttribute("transform")).toBe(
      `translate(${model.card.x} ${model.card.y}) scale(${model.card.scale})`,
    );
  });
});
