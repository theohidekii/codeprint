import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EXAMPLE_SNIPPET } from "@/features/trace/domain/examples";

import { copyPngToClipboard, downloadBlob } from "../export/files";
import { svgToPngBlob } from "../export/png";
import { highlight } from "../highlight/highlight";
import { SnapshotView } from "./snapshot-view";

vi.mock("../highlight/highlight", () => ({
  highlight: vi.fn(async (code: string) =>
    code.split("\n").map((text) => (text ? [{ text, color: "#ffffff" }] : [])),
  ),
}));
vi.mock("../export/fonts", () => ({
  loadEmbeddedFonts: async () => ({ mono: "data:,", sans: "data:," }),
}));
vi.mock("../export/png", () => ({
  svgToPngBlob: vi.fn(async () => new Blob(["png"], { type: "image/png" })),
}));
vi.mock("../export/files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../export/files")>()),
  downloadBlob: vi.fn(),
  copyPngToClipboard: vi.fn(async () => "copied"),
}));

/** The SVG behind the preview image. */
async function previewSvg(): Promise<string> {
  const image = await screen.findByRole("img", { name: "Snapshot preview" });
  return decodeURIComponent(image.getAttribute("src")!.split(",")[1]!);
}

async function withExample() {
  render(<SnapshotView />);
  await userEvent.click(screen.getByRole("button", { name: "Try an example" }));
  await screen.findByRole("img", { name: "Snapshot preview" });
}

describe("SnapshotView", () => {
  it("labels every option", () => {
    render(<SnapshotView />);

    for (const name of ["Theme", "Background", "Frame", "Size", "Padding"]) {
      expect(screen.getByRole("radiogroup", { name })).toBeInTheDocument();
    }
    expect(
      screen.getByRole("checkbox", { name: "Line numbers" }),
    ).toBeChecked();
    expect(screen.getByRole("textbox", { name: "Title" })).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Caption" }),
    ).toBeInTheDocument();
  });

  it("shows a placeholder and disables exports until there is code", () => {
    render(<SnapshotView />);

    expect(screen.getByText("Paste code to see it here.")).toBeInTheDocument();
    for (const name of ["Download PNG", "Download SVG", "Copy image"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
  });

  it("treats whitespace-only code as empty", async () => {
    render(<SnapshotView />);
    await userEvent.type(
      screen.getByRole("textbox", { name: "Code snippet" }),
      "   ",
    );

    expect(screen.getByText("Paste code to see it here.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download PNG" })).toBeDisabled();
  });

  it("previews the example and enables exports", async () => {
    await withExample();

    expect(await previewSvg()).toContain("debounce");
    for (const name of ["Download PNG", "Download SVG", "Copy image"]) {
      expect(screen.getByRole("button", { name })).toBeEnabled();
    }
  });

  it("updates the preview when an option changes", async () => {
    await withExample();

    await userEvent.click(
      within(screen.getByRole("radiogroup", { name: "Theme" })).getByRole(
        "radio",
        {
          name: "Paper",
        },
      ),
    );

    await waitFor(async () => expect(await previewSvg()).toContain("#ecebe6"));
  });

  it("locks exports while the preview is out of date", async () => {
    await withExample();
    const png = screen.getByRole("button", { name: "Download PNG" });
    expect(png).toBeEnabled();

    await userEvent.click(
      within(screen.getByRole("radiogroup", { name: "Theme" })).getByRole(
        "radio",
        {
          name: "Paper",
        },
      ),
    );

    expect(png).toBeDisabled();
    await waitFor(() => expect(png).toBeEnabled());
  });

  it("explains when the image can't be made, and offers no broken download", async () => {
    await withExample();
    vi.mocked(downloadBlob).mockClear();
    vi.mocked(svgToPngBlob).mockRejectedValueOnce(new Error("decode failed"));

    await userEvent.click(screen.getByRole("button", { name: "Download PNG" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Couldn't create the image. Try again.",
    );
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("hands Copy the image as a promise, so Safari accepts the write", async () => {
    await withExample();
    vi.mocked(copyPngToClipboard).mockClear();

    await userEvent.click(screen.getByRole("button", { name: "Copy image" }));

    expect(vi.mocked(copyPngToClipboard).mock.calls[0]![0]).toBeInstanceOf(
      Promise,
    );
  });

  it("explains when the preview can't be rendered, then recovers on the next edit", async () => {
    vi.mocked(highlight).mockRejectedValueOnce(new Error("chunk failed"));
    render(<SnapshotView />);
    const editor = screen.getByRole("textbox", { name: "Code snippet" });
    await userEvent.type(editor, "a");

    expect(
      await screen.findByText(
        "Couldn't render this snippet. Edit it to try again.",
      ),
    ).toBeInTheDocument();

    await userEvent.type(editor, "b");

    expect(
      await screen.findByRole("img", { name: "Snapshot preview" }),
    ).toBeInTheDocument();
  });

  it("gives the lines one tab stop and moves between them with the arrow keys", async () => {
    await withExample();
    const lines = screen.getAllByRole("button", { name: /^Highlight line/ });
    expect(lines.filter((line) => line.tabIndex === 0)).toHaveLength(1);

    lines[0]!.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(
      screen.getByRole("button", { name: "Highlight line 2" }),
    ).toHaveFocus();
    await userEvent.keyboard("{ArrowUp}{ArrowUp}");
    expect(
      screen.getByRole("button", { name: "Highlight line 1" }),
    ).toHaveFocus();

    await userEvent.keyboard("{End}");
    expect(lines.at(-1)).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(lines[0]).toHaveFocus();
    expect(
      screen
        .getAllByRole("button", { name: /^Highlight line/ })
        .filter((l) => l.tabIndex === 0),
    ).toEqual([lines[0]]);
  });

  it("toggles a line highlight from the preview", async () => {
    await withExample();
    const line = screen.getByRole("button", { name: "Highlight line 2" });
    expect(line).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.queryByRole("button", { name: "Clear highlights" }),
    ).not.toBeInTheDocument();

    await userEvent.click(line);

    expect(
      screen.getByRole("button", { name: "Highlight line 2" }),
    ).toHaveAttribute("aria-pressed", "true");
    await waitFor(async () =>
      expect(await previewSvg()).toContain('data-highlight="2"'),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Clear highlights" }),
    );
    expect(
      screen.getByRole("button", { name: "Highlight line 2" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("says when long code is cut", async () => {
    render(<SnapshotView />);
    const editor = screen.getByRole("textbox", { name: "Code snippet" });
    await userEvent.click(editor);
    await userEvent.paste(
      Array.from({ length: 90 }, (_, i) => `l${i}`).join("\n") +
        `\n${"x".repeat(130)}`,
    );

    expect(
      await screen.findByText("Showing the first 80 lines"),
    ).toBeInTheDocument();
  });

  it("says when long lines are cut", async () => {
    render(<SnapshotView />);
    await userEvent.click(
      screen.getByRole("textbox", { name: "Code snippet" }),
    );
    await userEvent.paste("y".repeat(130));

    expect(
      await screen.findByText("Long lines are cut at 120 characters"),
    ).toBeInTheDocument();
  });

  it("announces a successful copy", async () => {
    await withExample();

    await userEvent.click(screen.getByRole("button", { name: "Copy image" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Copied");
  });

  it("explains when copying isn't available", async () => {
    vi.mocked(copyPngToClipboard).mockResolvedValueOnce("unsupported");
    await withExample();

    await userEvent.click(screen.getByRole("button", { name: "Copy image" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Copy isn't available in this browser. Download the PNG instead.",
    );
  });

  it("uses the example's snippet", async () => {
    await withExample();

    expect(screen.getByRole("textbox", { name: "Code snippet" })).toHaveValue(
      EXAMPLE_SNIPPET.code,
    );
  });
});
