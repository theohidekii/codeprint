import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EXAMPLE_SNIPPET } from "../domain/examples";
import type { TraceResult } from "../domain/types";
import { TraceView } from "./trace-view";
import type { useTrace } from "./use-trace";

type Hook = ReturnType<typeof useTrace>;
const trace = vi.fn();
let hook: Hook;

vi.mock("./use-trace", () => ({ useTrace: () => hook }));

const base: Hook = {
  state: "idle",
  results: [],
  providers: {},
  language: null,
  error: null,
  trace,
  cancel: vi.fn(),
};

const aResult: TraceResult = {
  id: "acme/a/x.js",
  repository: "acme/a",
  path: "x.js",
  url: "https://github.com/acme/a/blob/c/x.js",
  stars: 5,
  similarity: 0.9,
  regions: [],
  renames: [],
  excerpt: { startLine: 1, lines: [] },
  contentHash: 1,
  vendored: false,
  copies: 0,
};

beforeEach(() => {
  trace.mockReset();
  hook = { ...base };
});

describe("TraceView", () => {
  it("fills the editor with an example", async () => {
    render(<TraceView />);

    await userEvent.click(
      screen.getByRole("button", { name: "Try an example" }),
    );

    expect(screen.getByRole("textbox", { name: "Code snippet" })).toHaveValue(
      EXAMPLE_SNIPPET.code,
    );
  });

  it("traces the snippet with the auto-detected language", async () => {
    render(<TraceView />);
    await userEvent.click(
      screen.getByRole("button", { name: "Try an example" }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Trace" }));

    expect(trace).toHaveBeenCalledWith({ code: EXAMPLE_SNIPPET.code });
  });

  it("sends an explicitly chosen language", async () => {
    render(<TraceView />);
    await userEvent.click(
      screen.getByRole("button", { name: "Try an example" }),
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Language" }),
      "TypeScript",
    );

    await userEvent.click(screen.getByRole("button", { name: "Trace" }));

    expect(trace).toHaveBeenCalledWith({
      code: EXAMPLE_SNIPPET.code,
      language: "typescript",
    });
  });

  it("disables tracing until there is code", () => {
    render(<TraceView />);

    expect(screen.getByRole("button", { name: "Trace" })).toBeDisabled();
  });

  it("announces progress and the result count", () => {
    hook = { ...base, state: "tracing" };
    const { rerender } = render(<TraceView />);
    expect(screen.getByRole("status")).toHaveTextContent("Tracing…");

    hook = {
      ...base,
      state: "done",
      results: [aResult, { ...aResult, id: "b" }],
    };
    rerender(<TraceView />);
    expect(screen.getByRole("status")).toHaveTextContent("2 matches found");
  });

  it("explains when nothing matched", () => {
    hook = { ...base, state: "done" };
    render(<TraceView />);

    expect(
      screen.getByText(
        "No public matches found. The code may be original, private, or changed beyond recognition.",
      ),
    ).toBeInTheDocument();
  });

  it.each(["error", "timeout"] as const)(
    "warns that results may be partial when Sourcegraph reports %s",
    (status) => {
      hook = {
        ...base,
        state: "done",
        results: [aResult],
        providers: { sourcegraph: status },
      };
      render(<TraceView />);

      expect(
        screen.getByText(
          "Sourcegraph didn't respond, so these results may be incomplete.",
        ),
      ).toBeInTheDocument();
    },
  );

  it("shows errors as alerts", () => {
    hook = {
      ...base,
      state: "error",
      error: "Too many traces in a minute. Try again shortly.",
    };
    render(<TraceView />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Too many traces in a minute. Try again shortly.",
    );
  });

  it("lists results as cards", () => {
    hook = { ...base, state: "done", results: [aResult] };
    render(<TraceView />);

    expect(screen.getByRole("article")).toHaveTextContent("acme/a");
  });
});
