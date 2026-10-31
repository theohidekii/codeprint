import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { TraceResult } from "../domain/types";
import { ComparisonView } from "./comparison-view";
import { ResultCard } from "./result-card";
import { SimilarityMeter } from "./similarity-meter";

const SNIPPET = [
  "let acc = 0;",
  "for (const v of values) acc += v;",
  "return acc;",
];

const result = (overrides: Partial<TraceResult> = {}): TraceResult => ({
  id: "acme/utils/src/sum.js",
  repository: "acme/utils",
  path: "src/sum.js",
  url: "https://github.com/acme/utils/blob/abc/src/sum.js#L11-L13",
  stars: 12400,
  similarity: 0.87,
  regions: [
    { snippet: { start: 1, end: 2 }, candidate: { start: 11, end: 12 } },
  ],
  renames: [
    { from: "acc", to: "total" },
    { from: "values", to: "items" },
  ],
  excerpt: {
    startLine: 10,
    lines: [
      "// helpers",
      "let total = 0;",
      "for (const v of items) total += v;",
      "return total * 2;",
    ],
  },
  contentHash: 1,
  vendored: false,
  copies: 0,
  ...overrides,
});

describe("SimilarityMeter", () => {
  it("is an accessible meter with a visible percentage", () => {
    render(<SimilarityMeter value={0.87} />);
    const meter = screen.getByRole("meter");

    expect(meter).toHaveAttribute("aria-valuenow", "87");
    expect(meter).toHaveAttribute("aria-valuemin", "0");
    expect(meter).toHaveAttribute("aria-valuemax", "100");
    expect(screen.getByText("87% similar")).toBeInTheDocument();
  });
});

describe("ResultCard", () => {
  it("shows where the match is and how popular the repository is", () => {
    render(<ResultCard result={result()} snippetLines={SNIPPET} />);

    expect(screen.getByText("acme/utils")).toBeInTheDocument();
    expect(screen.getByText("src/sum.js")).toBeInTheDocument();
    expect(screen.getByText("12.4K")).toBeInTheDocument();
  });

  it("links to the matched lines on GitHub in a new tab", () => {
    render(<ResultCard result={result()} snippetLines={SNIPPET} />);
    const link = screen.getByRole("link", { name: "Open on GitHub" });

    expect(link).toHaveAttribute("href", result().url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("notes collapsed copies and vendored files", () => {
    const { rerender } = render(
      <ResultCard result={result({ copies: 3 })} snippetLines={SNIPPET} />,
    );
    expect(
      screen.getByText("Also found in 3 other copies"),
    ).toBeInTheDocument();

    rerender(
      <ResultCard
        result={result({ copies: 1, vendored: true })}
        snippetLines={SNIPPET}
      />,
    );
    expect(screen.getByText("Also found in 1 other copy")).toBeInTheDocument();
    expect(screen.getByText("Vendored copy")).toBeInTheDocument();
  });

  it("expands into a side-by-side comparison", async () => {
    render(<ResultCard result={result()} snippetLines={SNIPPET} />);
    const toggle = screen.getByRole("button", { name: "Compare" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("region", { name: "Your snippet" }),
    ).not.toBeInTheDocument();

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("region", { name: "Your snippet" }),
    ).toBeInTheDocument();
  });
});

describe("ComparisonView", () => {
  it("highlights matched lines on both sides", () => {
    render(<ComparisonView result={result()} snippetLines={SNIPPET} />);
    const mine = screen.getByRole("region", { name: "Your snippet" });
    const theirs = screen.getByRole("region", { name: "acme/utils" });

    const matched = (region: HTMLElement) =>
      [...region.querySelectorAll("[data-matched='true']")].map((el) =>
        el.getAttribute("data-line"),
      );
    expect(matched(mine)).toEqual(["1", "2"]);
    expect(matched(theirs)).toEqual(["11", "12"]);
    expect(within(theirs).getByText("let total = 0;")).toBeInTheDocument();
  });

  it("lists renamed identifiers", () => {
    render(<ComparisonView result={result()} snippetLines={SNIPPET} />);

    expect(screen.getByText("acc → total")).toBeInTheDocument();
    expect(screen.getByText("values → items")).toBeInTheDocument();
  });
});
