import { http, HttpResponse } from "msw";

import { server } from "@/test/msw/server";

import { copyPngToClipboard, downloadBlob, filenameFor } from "./files";
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

describe("filenameFor", () => {
  it.each([
    ["My Debounce!", "codeprint-js", "png", "my-debounce.png"],
    ["", "codeprint-go", "svg", "codeprint-go.svg"],
    ["   ", "codeprint-rust", "png", "codeprint-rust.png"],
    ["vercel/next.js", "poster", "png", "vercel-next-js.png"],
  ] as const)("names %j as %s", (title, fallback, ext, expected) => {
    expect(filenameFor(title, fallback, ext)).toBe(expected);
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

  it("starts the clipboard write before the image is ready, as Safari requires", async () => {
    const write = vi.fn(async () => {});
    stub(write);
    let finish!: (blob: Blob) => void;
    const pending = new Promise<Blob>((resolve) => (finish = resolve));

    const result = copyPngToClipboard(pending);

    // Safari only allows the write within the click, so it must not wait for the PNG.
    expect(write).toHaveBeenCalledTimes(1);
    finish(png);
    expect(await result).toBe("copied");
  });

  it("reports a failure to make the image as unsupported", async () => {
    stub(async () => {});

    expect(
      await copyPngToClipboard(Promise.reject(new Error("decode failed"))),
    ).toBe("unsupported");
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

    vi.useFakeTimers();
    downloadBlob(new Blob(["x"]), "snap.png");

    expect(create).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    // Revoking right away can cancel the download in some browsers.
    expect(revoke).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith("blob:x");
    vi.useRealTimers();
    create.mockRestore();
    revoke.mockRestore();
    click.mockRestore();
  });
});
