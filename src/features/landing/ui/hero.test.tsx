import { render, screen } from "@testing-library/react";

import { Hero } from "./hero";

describe("Hero", () => {
  it("states what Codeprint is", () => {
    render(<Hero />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "The fingerprint of code.",
    );
    expect(
      screen.getByText(
        "Trace a snippet back to its source, even after the variables were renamed. Then turn code into something worth sharing.",
      ),
    ).toBeInTheDocument();
  });

  it("offers tracing as the primary action", () => {
    render(<Hero />);

    expect(
      screen.getByRole("link", { name: "Trace a snippet" }),
    ).toHaveAttribute("href", "/trace");
  });

  it("links to the source code in a new tab without leaking the opener", () => {
    render(<Hero />);
    const github = screen.getByRole("link", { name: "View on GitHub" });

    expect(github).toHaveAttribute(
      "href",
      "https://github.com/theohidekii/codeprint",
    );
    expect(github.getAttribute("rel")).toContain("noopener");
  });
});
