import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LanguageSelect } from "./language-select";

describe("LanguageSelect", () => {
  it("offers auto-detection first, naming the detected language", () => {
    render(
      <LanguageSelect value="auto" detected="python" onChange={vi.fn()} />,
    );
    const select = screen.getByRole("combobox", { name: "Language" });

    expect(select.querySelector("option")).toHaveTextContent(
      "Auto-detect (Python)",
    );
    expect(select).toHaveValue("auto");
  });

  it("lists every supported language", () => {
    render(
      <LanguageSelect value="auto" detected="generic" onChange={vi.fn()} />,
    );

    expect(screen.getAllByRole("option")).toHaveLength(13);
    expect(screen.getByRole("option", { name: "C#" })).toBeInTheDocument();
  });

  it("reports the chosen language", async () => {
    const onChange = vi.fn();
    render(
      <LanguageSelect value="auto" detected="python" onChange={onChange} />,
    );

    await userEvent.selectOptions(screen.getByRole("combobox"), "Go");

    expect(onChange).toHaveBeenCalledWith("go");
  });
});
