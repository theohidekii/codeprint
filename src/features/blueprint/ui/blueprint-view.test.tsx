import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";

import { downloadBlob } from "@/shared/lib/export/files";
import { svgToPngBlob } from "@/shared/lib/export/png";
import { server } from "@/test/msw/server";

import type { Analysis } from "../server/analyze";
import { BlueprintView } from "./blueprint-view";

vi.mock("@/shared/lib/export/fonts", () => ({
  loadEmbeddedFonts: async () => ({ mono: "data:,", sans: "data:," }),
}));
vi.mock("@/shared/lib/export/png", () => ({
  svgToPngBlob: vi.fn(async () => new Blob(["png"], { type: "image/png" })),
}));
vi.mock("@/shared/lib/export/files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/lib/export/files")>()),
  downloadBlob: vi.fn(),
  copyPngToClipboard: vi.fn(async () => "copied"),
}));

const ENDPOINT = "*/api/blueprint";

const analysis: Analysis = {
  repository: "vercel/swr",
  branch: "main",
  files: 30,
  truncated: false,
  modules: [
    { id: "src/core", name: "src/core", bytes: 50000, files: 20 },
    { id: "src/ui", name: "src/ui", bytes: 30000, files: 10 },
  ],
  edges: [{ from: "src/ui", to: "src/core", weight: 4 }],
  hotspots: [{ moduleId: "src/core", reason: "largest" }],
  unreadLanguages: [],
  sampled: false,
  topLanguage: "TypeScript",
};

function serve(body: Analysis = analysis) {
  const targets: string[] = [];
  server.use(
    http.get(ENDPOINT, ({ request }) => {
      targets.push(new URL(request.url).searchParams.get("target") ?? "");
      return HttpResponse.json(body);
    }),
  );
  return targets;
}

const input = () => screen.getByRole("textbox", { name: "GitHub repository" });
const plan = () =>
  screen.findByRole("img", { name: "Floor plan of vercel/swr" });
const svgOf = (image: HTMLElement) =>
  decodeURIComponent(image.getAttribute("src")!.split(",")[1]!);

async function withPlan(body?: Analysis) {
  const targets = serve(body);
  render(<BlueprintView />);
  await userEvent.type(input(), "vercel/swr{Enter}");
  await plan();
  return targets;
}

describe("BlueprintView", () => {
  it("disables Generate until something is typed", () => {
    render(<BlueprintView />);

    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
  });

  it("generates the example", async () => {
    const targets = serve();
    render(<BlueprintView />);

    await userEvent.click(
      screen.getByRole("button", { name: "Try an example" }),
    );

    await plan();
    expect(targets).toEqual(["vercel/swr"]);
  });

  it.each(["octocat", "a/.."])(
    "refuses %s without asking the server",
    async (name) => {
      const targets = serve();
      render(<BlueprintView />);

      await userEvent.type(input(), `${name}{Enter}`);

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Enter a repository as owner/repo.",
      );
      expect(targets).toEqual([]);
    },
  );

  it("clears the old plan when the next name is invalid", async () => {
    await withPlan();

    await userEvent.clear(input());
    await userEvent.type(input(), "nope{Enter}");

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("says it is working, and shows server errors", async () => {
    const message = "No public GitHub user or repository with that name.";
    server.use(
      http.get(ENDPOINT, async () => {
        await delay(100);
        return HttpResponse.json(
          { error: "not-found", message },
          { status: 404 },
        );
      }),
    );
    render(<BlueprintView />);

    await userEvent.type(input(), "a/b{Enter}");

    expect(screen.getByRole("status")).toHaveTextContent(
      "Reading the repository…",
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });

  it("zooms with buttons and keeps within limits", async () => {
    await withPlan();
    const viewport = screen.getByRole("group", { name: "Floor plan viewer" });
    const zoomIn = screen.getByRole("button", { name: "Zoom in" });

    expect(viewport).toHaveAttribute("data-zoom", "1");
    await userEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(viewport).toHaveAttribute("data-zoom", "1");
    for (let i = 0; i < 12; i++) await userEvent.click(zoomIn);
    expect(viewport).toHaveAttribute("data-zoom", "6");
    await userEvent.click(screen.getByRole("button", { name: "Reset view" }));
    expect(viewport).toHaveAttribute("data-zoom", "1");
  });

  it("pans with the arrow keys once zoomed", async () => {
    await withPlan();
    const viewport = screen.getByRole("group", { name: "Floor plan viewer" });
    await userEvent.click(screen.getByRole("button", { name: "Zoom in" }));

    fireEvent.keyDown(viewport, { key: "ArrowRight" });

    expect(viewport.getAttribute("data-pan")).not.toBe("0,0");
  });

  it("lists rooms and highlights the selected one in the plan", async () => {
    await withPlan();
    const table = screen.getByRole("table", { name: "Rooms" });
    const row = within(table).getByRole("row", { name: /src\/ui/ });

    expect(row).toHaveTextContent("29.3 KB");
    expect(row).toHaveTextContent("10");
    await userEvent.click(within(row).getByRole("button", { name: "src/ui" }));

    expect(within(row).getByRole("button", { name: "src/ui" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await waitFor(async () =>
      expect(svgOf(await plan())).not.toContain('opacity="0.3"'),
    );
    await userEvent.click(within(row).getByRole("button", { name: "src/ui" }));
    expect(within(row).getByRole("button", { name: "src/ui" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it.each([
    [{ sampled: true }, "Dependencies are based on the 300 largest files."],
    [
      { truncated: true },
      "GitHub cut this repository's file list, so the plan may be incomplete.",
    ],
    [
      { unreadLanguages: ["Go"] },
      "Dependencies aren't read for this language yet: Go.",
    ],
  ])("explains limits %j", async (overrides, message) => {
    await withPlan({ ...analysis, ...overrides });

    expect(screen.getByText(message)).toBeInTheDocument();
  });

  it("explains a repository with no source code", async () => {
    serve({ ...analysis, modules: [], edges: [], hotspots: [] });
    render(<BlueprintView />);

    await userEvent.type(input(), "vercel/swr{Enter}");

    expect(
      await screen.findByText("No source code to draw in this repository."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Download PNG" }),
    ).not.toBeInTheDocument();
  });

  it("changes theme and size without asking the server again", async () => {
    const targets = await withPlan();

    await userEvent.click(screen.getByRole("radio", { name: "Paper" }));
    await userEvent.click(screen.getByRole("radio", { name: /LinkedIn/ }));

    await waitFor(async () => {
      const svg = svgOf(await plan());
      expect(svg).toContain("#ecebe6");
      expect(svg).toContain('width="1200"');
    });
    expect(targets).toHaveLength(1);
  });

  it("names downloads after the repository, and explains failures", async () => {
    await withPlan();
    vi.mocked(downloadBlob).mockClear();

    await userEvent.click(screen.getByRole("button", { name: "Download PNG" }));
    await waitFor(() =>
      expect(downloadBlob).toHaveBeenCalledWith(
        expect.any(Blob),
        "vercel-swr.png",
      ),
    );

    vi.mocked(svgToPngBlob).mockRejectedValueOnce(new Error("decode"));
    await userEvent.click(screen.getByRole("button", { name: "Download PNG" }));
    expect(
      await screen.findByText("Couldn't create the image. Try again."),
    ).toBeInTheDocument();
  });
});
