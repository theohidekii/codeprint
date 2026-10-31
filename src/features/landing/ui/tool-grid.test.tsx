import { render, screen, within } from "@testing-library/react";

import { tools } from "@/shared/lib/tools";

import { ToolGrid } from "./tool-grid";

describe("ToolGrid", () => {
  it("shows one card per tool with its name, tagline, status and link", () => {
    render(<ToolGrid tools={tools} />);
    const cards = screen.getAllByRole("article");

    expect(cards).toHaveLength(4);
    cards.forEach((card, i) => {
      const tool = tools[i]!;
      expect(
        within(card).getByRole("heading", { name: tool.name }),
      ).toBeInTheDocument();
      expect(within(card).getByText(tool.tagline)).toBeInTheDocument();
      expect(
        within(card).getByText(
          tool.status === "available" ? "Available" : "Coming soon",
        ),
      ).toBeInTheDocument();
      expect(within(card).getByRole("link")).toHaveAttribute(
        "href",
        `/${tool.slug}`,
      );
    });
  });

  it("renders nothing when there are no tools", () => {
    const { container } = render(<ToolGrid tools={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
