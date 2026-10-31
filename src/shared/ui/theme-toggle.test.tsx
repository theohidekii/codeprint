import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ThemeToggle } from "./theme-toggle";

const setTheme = vi.fn();
let currentTheme: string | undefined = "system";

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: currentTheme, setTheme }),
}));

beforeEach(() => {
  setTheme.mockReset();
  currentTheme = "system";
});

describe("ThemeToggle", () => {
  it("names the current mode in its accessible label", () => {
    render(<ThemeToggle />);

    expect(
      screen.getByRole("button", { name: /theme: system/i }),
    ).toBeInTheDocument();
  });

  it.each([
    ["system", "light"],
    ["light", "dark"],
    ["dark", "system"],
  ])("moves from %s to %s when clicked", async (from, to) => {
    currentTheme = from;
    render(<ThemeToggle />);

    await userEvent.click(screen.getByRole("button"));

    expect(setTheme).toHaveBeenCalledWith(to);
  });

  it("treats an unresolved theme as system", () => {
    currentTheme = undefined;
    render(<ThemeToggle />);

    expect(
      screen.getByRole("button", { name: /theme: system/i }),
    ).toBeInTheDocument();
  });
});
