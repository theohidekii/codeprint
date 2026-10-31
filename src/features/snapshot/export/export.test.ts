import { http, HttpResponse } from "msw";

import { server } from "@/test/msw/server";

import { copyPngToClipboard, downloadBlob, snapshotFilename } from "./files";
import { loadEmbeddedFonts, resetEmbeddedFonts } from "./fonts";

describe("loadEmbeddedFonts", () => {
  beforeEach(() => resetEmbeddedFonts());

  it("turns both bundled fonts into data URLs, fetching each once", async () => {
    const fetched: string[] = [];
    server.use(
      http.get("*/fonts/:file", ({ params }) => {
        fetched.push(String(params.file));
        return new HttpResponse(new Uint8Array([1, 2, 3]), {
          headers: { "content-type": "font/woff2" },
        });
      }),
    );

    const first = await loadEmbeddedFonts();
    await loadEmbeddedFonts();

    expect(first).toEqual({
      mono: "data:font/woff2;base64,AQID",
      sans: "data:font/woff2;base64,AQID",
    });
    expect(fetched.sort()).toEqual([
      "FragmentMono-Regular.woff2",
      "SchibstedGrotesk-Bold.woff2",
    ]);
  });
});

describe("snapshotFilename", () => {
  it.each([
    ["My Debounce!", "javascript", "png", "my-debounce.png"],
    ["", "go", "svg", "codeprint-go.svg"],
    ["   ", "rust", "png", "codeprint-rust.png"],
    ["main.go", "go", "svg", "main-go.svg"],
  ] as const)("names %j as %s", (title, language, ext, expected) => {
    expect(snapshotFilename(title, language, ext)).toBe(expected);
  });
});

describe("copyPngToClipboard", () => {
  const png = new Blob([new Uint8Array([1])], { type: "image/png" });
  const original = {
    clipboard: navigator.clipboard,
    item: globalThis.ClipboardItem,
  };

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: original.clipboard,
      configurable: true,
    });
    globalThis.ClipboardItem = original.item;
  });

  function stub(write?: () => Promise<void>, withItem = true) {
    Object.defineProperty(navigator, "clipboard", {
      value: write ? { write } : undefined,
      configurable: true,
    });
    globalThis.ClipboardItem = withItem
      ? (class {
          constructor(public items: Record<string, Blob>) {}
        } as unknown as typeof ClipboardItem)
      : (undefined as unknown as typeof ClipboardItem);
  }

  it("copies when the clipboard accepts images", async () => {
    const write = vi.fn(async () => {});
    stub(write);

    expect(await copyPngToClipboard(png)).toBe("copied");
    expect(write).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["no clipboard API", () => stub(undefined)],
    ["no ClipboardItem", () => stub(async () => {}, false)],
    [
      "a denied write",
      () => stub(async () => Promise.reject(new Error("denied"))),
    ],
  ])("reports unsupported with %s", async (_, setup) => {
    setup();

    expect(await copyPngToClipboard(png)).toBe("unsupported");
  });
});

describe("downloadBlob", () => {
  it("clicks a temporary download link and releases the URL", () => {
    const create = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:x");
    const revoke = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe("snap.png");
        expect(this.href).toBe("blob:x");
      });

    downloadBlob(new Blob(["x"]), "snap.png");

    expect(create).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith("blob:x");
    create.mockRestore();
    revoke.mockRestore();
    click.mockRestore();
  });
});
