import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SiteHeader } from "./site-header";

let pathname = "/";

vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "system", setTheme: vi.fn() }),
}));

beforeEach(() => {
  pathname = "/";
});

describe("SiteHeader", () => {
  it("links to every tool from the primary navigation", () => {
    render(<SiteHeader />);
    const nav = screen.getByRole("navigation", { name: "Primary" });

    const links = within(nav).getAllByRole("link");

    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/trace",
      "/snapshot",
      "/fingerprint",
      "/blueprint",
    ]);
  });

  it("marks the link for the current page", () => {
    pathname = "/snapshot";
    render(<SiteHeader />);
    const nav = screen.getByRole("navigation", { name: "Primary" });

    expect(within(nav).getByRole("link", { name: "Snapshot" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      within(nav).getByRole("link", { name: "Trace" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("opens and closes the menu with its button", async () => {
    render(<SiteHeader />);
    const button = screen.getByRole("button", { name: /menu/i });
    expect(button).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("navigation", { name: "Menu" });
    expect(within(menu).getAllByRole("link")).toHaveLength(4);
  });

  it("closes the menu on Escape and returns focus to the button", async () => {
    render(<SiteHeader />);
    const button = screen.getByRole("button", { name: /menu/i });
    await userEvent.click(button);

    await userEvent.keyboard("{Escape}");

    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("navigation", { name: "Menu" }),
    ).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it("links the brand to the home page", () => {
    render(<SiteHeader />);

    expect(
      screen.getByRole("link", { name: "Codeprint home" }),
    ).toHaveAttribute("href", "/");
  });
});
