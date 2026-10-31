import { render, screen, within } from "@testing-library/react";

import { HowItWorks } from "./how-it-works";

describe("HowItWorks", () => {
  it("walks through the three matching steps in order", () => {
    render(<HowItWorks />);
    const items = within(screen.getByRole("list")).getAllByRole("listitem");

    expect(items).toHaveLength(3);
    expect(
      items.map((item) => within(item).getByRole("heading").textContent),
    ).toEqual(["Tokenize", "Normalize", "Fingerprint"]);
  });

  it("uses an ordered list, because the steps are a sequence", () => {
    render(<HowItWorks />);

    expect(screen.getByRole("list").tagName).toBe("OL");
  });
});
