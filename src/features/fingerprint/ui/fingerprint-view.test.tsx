import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { copyPngToClipboard, downloadBlob } from "@/shared/lib/export/files";
import { svgToPngBlob } from "@/shared/lib/export/png";
import { server } from "@/test/msw/server";

import type { Profile } from "../domain/profile";
import { FingerprintView } from "./fingerprint-view";

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

const ENDPOINT = "*/api/fingerprint";

const profile: Profile = {
  kind: "repo",
  name: "vercel/next.js",
  languages: [{ name: "TypeScript", share: 1 }],
  hours: Array<number>(24).fill(1),
  weekdays: Array<number>(7).fill(1),
  sizes: { count: 100, median: 10 },
  stars: 1000,
  sampled: 24,
};

function serve() {
  const targets: string[] = [];
  server.use(
    http.get(ENDPOINT, ({ request }) => {
      targets.push(new URL(request.url).searchParams.get("target") ?? "");
      return HttpResponse.json(profile);
    }),
  );
  return targets;
}

const input = () =>
  screen.getByRole("textbox", { name: "GitHub user or repository" });
const generate = () => screen.getByRole("button", { name: "Generate" });
const poster = () =>
  screen.findByRole("img", { name: "Poster for vercel/next.js" });
const svgOf = (image: HTMLElement) =>
  decodeURIComponent(image.getAttribute("src")!.split(",")[1]!);

async function withPoster() {
  const targets = serve();
  render(<FingerprintView />);
  await userEvent.type(input(), "vercel/next.js{Enter}");
  await poster();
  return targets;
}

describe("FingerprintView", () => {
  it("disables Generate until something is typed", async () => {
    render(<FingerprintView />);
    expect(generate()).toBeDisabled();

    await userEvent.type(input(), "a");

    expect(generate()).toBeEnabled();
  });

  it("generates on Enter", async () => {
    const targets = await withPoster();

    expect(targets).toEqual(["vercel/next.js"]);
  });

  it("trims what was typed and generates with the button", async () => {
    const targets = serve();
    render(<FingerprintView />);
    await userEvent.type(input(), "  vercel/next.js ");

    await userEvent.click(generate());

    await poster();
    expect(targets).toEqual(["vercel/next.js"]);
  });

  it("generates the example", async () => {
    const targets = serve();
    render(<FingerprintView />);

    await userEvent.click(
      screen.getByRole("button", { name: "Try an example" }),
    );

    expect(input()).toHaveValue("vercel/next.js");
    await poster();
    expect(targets).toEqual(["vercel/next.js"]);
  });

  it("explains an invalid name without asking the server", async () => {
    const targets = serve();
    render(<FingerprintView />);

    await userEvent.type(input(), "../../etc{Enter}");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a GitHub username or owner/repo.",
    );
    expect(targets).toEqual([]);
  });

  it("says it is working while the request runs", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.get(ENDPOINT, async () => {
        await gate;
        return HttpResponse.json(profile);
      }),
    );
    render(<FingerprintView />);

    await userEvent.type(input(), "vercel/next.js{Enter}");

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Reading public activity…",
    );
    release();
    await poster();
  });

  it("shows the server's error message", async () => {
    const message = "No public GitHub user or repository with that name.";
    server.use(
      http.get(ENDPOINT, () =>
        HttpResponse.json({ error: "not-found", message }, { status: 404 }),
      ),
    );
    render(<FingerprintView />);

    await userEvent.type(input(), "nobody{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });

  it("explains a network failure", async () => {
    server.use(http.get(ENDPOINT, () => HttpResponse.error()));
    render(<FingerprintView />);

    await userEvent.type(input(), "nobody{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't reach the server. Check your connection and try again.",
    );
  });

  it("changes theme and size without asking the server again", async () => {
    const targets = await withPoster();

    await userEvent.click(
      within(screen.getByRole("radiogroup", { name: "Theme" })).getByRole(
        "radio",
        {
          name: "Paper",
        },
      ),
    );
    await userEvent.click(
      within(screen.getByRole("radiogroup", { name: "Size" })).getByRole(
        "radio",
        {
          name: /Landscape/,
        },
      ),
    );

    await waitFor(async () => {
      const svg = svgOf(await poster());
      expect(svg).toContain("#ecebe6");
      expect(svg).toContain('width="1200"');
    });
    expect(targets).toHaveLength(1);
  });

  it("explains how to read the poster", async () => {
    await withPoster();
    const list = within(screen.getByRole("list", { name: "How to read it" }));

    for (const text of [/pattern/i, /languages/i, /calm|restless/i, /hour/i]) {
      expect(list.getByText(text)).toBeInTheDocument();
    }
  });

  it("names downloads after the account", async () => {
    await withPoster();
    vi.mocked(downloadBlob).mockClear();

    await userEvent.click(screen.getByRole("button", { name: "Download PNG" }));

    await waitFor(() =>
      expect(downloadBlob).toHaveBeenCalledWith(
        expect.any(Blob),
        "vercel-next-js.png",
      ),
    );
  });

  it("explains when the image can't be made", async () => {
    await withPoster();
    vi.mocked(svgToPngBlob).mockRejectedValueOnce(new Error("decode failed"));

    await userEvent.click(screen.getByRole("button", { name: "Download PNG" }));

    expect(
      await screen.findByText("Couldn't create the image. Try again."),
    ).toBeInTheDocument();
  });

  it("hands Copy the image as a promise, and announces the result", async () => {
    await withPoster();
    vi.mocked(copyPngToClipboard).mockClear();

    await userEvent.click(screen.getByRole("button", { name: "Copy image" }));

    expect(vi.mocked(copyPngToClipboard).mock.calls[0]![0]).toBeInstanceOf(
      Promise,
    );
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });

  it("shows nothing to export before a poster exists", () => {
    render(<FingerprintView />);

    expect(
      screen.queryByRole("button", { name: "Download PNG" }),
    ).not.toBeInTheDocument();
  });
});
