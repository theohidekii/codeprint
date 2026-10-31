import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { CodeEditor } from "./code-editor";

function Harness({
  onSubmit = vi.fn(),
  initial = "",
}: {
  onSubmit?: () => void;
  initial?: string;
}) {
  const [value, setValue] = useState(initial);
  return <CodeEditor value={value} onChange={setValue} onSubmit={onSubmit} />;
}

describe("CodeEditor", () => {
  it("is a labelled text area", () => {
    render(<Harness />);

    expect(
      screen.getByRole("textbox", { name: "Code snippet" }),
    ).toBeInTheDocument();
  });

  it("numbers every line in the gutter", () => {
    render(<Harness initial={"a\nb\nc"} />);

    expect(screen.getByTestId("gutter")).toHaveTextContent("123");
    expect(screen.getByTestId("gutter").children).toHaveLength(3);
  });

  it.each(["{Control>}{Enter}{/Control}", "{Meta>}{Enter}{/Meta}"])(
    "submits on %s",
    async (keys) => {
      const onSubmit = vi.fn();
      render(<Harness onSubmit={onSubmit} />);
      await userEvent.click(screen.getByRole("textbox"));

      await userEvent.keyboard(keys);

      expect(onSubmit).toHaveBeenCalledTimes(1);
    },
  );

  it("inserts a newline on a plain Enter", async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    const editor = screen.getByRole("textbox");

    await userEvent.type(editor, "a{Enter}b");

    expect(editor).toHaveValue("a\nb");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
