import { type ColoredLine, layoutSnapshot } from "./layout";
import { DEFAULT_OPTIONS, type SnapshotOptions } from "./options";
import { CHAR_WIDTH_RATIO } from "./text-width";

const CHAR = 16 * CHAR_WIDTH_RATIO;
const LINE = 25.6;

const plain = (...texts: string[]): ColoredLine[] =>
  texts.map((text) => (text ? [{ text, color: "#ffffff" }] : []));

const opts = (patch: Partial<SnapshotOptions> = {}): SnapshotOptions => ({
  ...DEFAULT_OPTIONS,
  ...patch,
});

describe("layoutSnapshot", () => {
  const three = plain("const a = 1;", "x".repeat(20), "b();");

  it("sizes an auto snapshot from its longest line", () => {
    const model = layoutSnapshot(three, opts(), "JavaScript");
    const gutter = 1 * CHAR + 20;

    expect(model.gutter).toEqual({ width: gutter });
    expect(model.card.width).toBeCloseTo(28 * 2 + gutter + 20 * CHAR);
    expect(model.card.height).toBeCloseTo(44 + 28 * 2 + 3 * LINE);
    expect(model.width).toBeCloseTo(model.card.width + 2 * 56);
    expect(model.height).toBeCloseTo(model.card.height + 2 * 56);
    expect(model.card).toMatchObject({ x: 56, y: 56, scale: 1 });
  });

  it("places lines and tokens on the monospace grid", () => {
    const lines: ColoredLine[] = [
      [
        { text: "const", color: "#a" },
        { text: " a", color: "#b" },
      ],
      [{ text: "b", color: "#c" }],
    ];
    const model = layoutSnapshot(lines, opts(), "JavaScript");
    const left = 28 + (1 * CHAR + 20);

    expect(model.lines[1]!.y - model.lines[0]!.y).toBeCloseTo(LINE);
    expect(model.lines[0]!.tokens.map((t) => t.x)).toEqual([
      left,
      left + 5 * CHAR,
    ]);
  });

  it("drops the window bar and the gutter when asked", () => {
    const framed = layoutSnapshot(three, opts(), "JavaScript");
    const bare = layoutSnapshot(
      three,
      opts({ frame: "minimal", lineNumbers: false }),
      "JavaScript",
    );

    expect(bare.bar).toBeNull();
    expect(bare.gutter).toBeNull();
    expect(framed.card.height - bare.card.height).toBeCloseTo(44);
  });

  it("titles the window with the language when no title is set", () => {
    expect(layoutSnapshot(three, opts(), "Go").bar?.title).toBe("Go");
    expect(
      layoutSnapshot(three, opts({ title: "main.go" }), "Go").bar?.title,
    ).toBe("main.go");
  });

  it("highlights chosen lines and dims the rest", () => {
    const model = layoutSnapshot(three, opts({ highlighted: [2] }), "JS");

    expect(model.lines.map((l) => [l.highlighted, l.dimmed])).toEqual([
      [false, true],
      [true, false],
      [false, true],
    ]);
    expect(
      layoutSnapshot(three, opts(), "JS").lines.some((l) => l.dimmed),
    ).toBe(false);
  });

  it.each([
    ["linkedin", 1200, 627],
    ["square", 1080, 1080],
  ] as const)(
    "fits the %s preset exactly and centers the card",
    (size, w, h) => {
      const big = plain(...Array.from({ length: 60 }, () => "y".repeat(100)));
      const model = layoutSnapshot(big, opts({ size }), "JS");

      expect([model.width, model.height]).toEqual([w, h]);
      expect(model.card.scale).toBeLessThan(1);
      expect(
        model.card.x * 2 + model.card.width * model.card.scale,
      ).toBeCloseTo(w);
      expect(model.card.width * model.card.scale).toBeLessThanOrEqual(
        w - 2 * 56 + 0.01,
      );
      expect(model.card.height * model.card.scale).toBeLessThanOrEqual(
        h - 2 * 56 + 0.01,
      );
    },
  );

  it("never enlarges a small card in a fixed size", () => {
    expect(
      layoutSnapshot(three, opts({ size: "square" }), "JS").card.scale,
    ).toBe(1);
  });

  it("cuts more than 80 lines and says so", () => {
    const model = layoutSnapshot(plain(...Array(200).fill("a")), opts(), "JS");

    expect(model.lines).toHaveLength(80);
    expect(model.truncated).toEqual({ lines: true, columns: false });
  });

  it("cuts lines at 120 columns with an ellipsis and says so", () => {
    const model = layoutSnapshot(plain("z".repeat(300)), opts(), "JS");
    const text = model.lines[0]!.tokens.map((t) => t.text).join("");

    expect(text).toHaveLength(120);
    expect(text.endsWith("…")).toBe(true);
    expect(model.truncated.columns).toBe(true);
  });

  it("lays out 5,000 lines of 200 columns in under 100ms", () => {
    const huge = plain(...Array(5000).fill("w".repeat(200)));
    const started = performance.now();

    layoutSnapshot(huge, opts(), "JS");

    expect(performance.now() - started).toBeLessThan(100);
  });

  it("keeps wide characters inside the card", () => {
    const model = layoutSnapshot(
      plain("日本語"),
      opts({ lineNumbers: false, frame: "minimal" }),
      "JS",
    );

    expect(model.card.width).toBeCloseTo(28 * 2 + 6 * CHAR);
  });

  it("expands tabs to two spaces", () => {
    const model = layoutSnapshot(plain("\tx"), opts(), "JS");

    expect(model.lines[0]!.tokens[0]!.text).toBe("  x");
  });

  it("adds room for a caption below the card", () => {
    const without = layoutSnapshot(three, opts(), "JS");
    const withCaption = layoutSnapshot(
      three,
      opts({ caption: "Found it" }),
      "JS",
    );

    expect(withCaption.height - without.height).toBeCloseTo(40);
    expect(withCaption.caption?.text).toBe("Found it");
    expect(withCaption.caption!.y).toBeGreaterThan(
      withCaption.card.y + withCaption.card.height,
    );
    expect(without.caption).toBeNull();
  });
});
