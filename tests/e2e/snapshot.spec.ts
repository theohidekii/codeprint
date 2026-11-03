import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

async function openWithExample(page: Page) {
  await page.goto("/snapshot");
  const editor = page.getByRole("textbox", { name: "Code snippet" });
  // The button is in the server HTML before React hydrates, so retry until it takes effect.
  await expect(async () => {
    await page.getByRole("button", { name: "Try an example" }).click();
    await expect(editor).toHaveValue(/function debounce/, { timeout: 500 });
  }).toPass();
  await expect(
    page.getByRole("img", { name: "Snapshot preview" }),
  ).toBeVisible();
}

async function download(page: Page, button: string) {
  const [file] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: button }).click(),
  ]);
  return {
    name: file.suggestedFilename(),
    bytes: await readFile((await file.path())!),
  };
}

/** Width and height from a PNG's IHDR chunk. */
function pngSize(bytes: Buffer) {
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

test("downloads an SVG with embedded fonts and a 2× PNG of the same size", async ({
  page,
}) => {
  await openWithExample(page);

  const svg = await download(page, "Download SVG");
  const text = svg.bytes.toString("utf8");
  expect(svg.name).toBe("codeprint-javascript.svg");
  expect(text).toContain("@font-face");
  expect(text).toContain("debounce");
  const svgWidth = Number(/<svg[^>]* width="([\d.]+)"/.exec(text)![1]);

  const png = await download(page, "Download PNG");
  expect(png.name).toBe("codeprint-javascript.png");
  expect(png.bytes.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  expect(pngSize(png.bytes).width).toBe(Math.round(svgWidth * 2));
});

test("exports LinkedIn-sized images", async ({ page }) => {
  await openWithExample(page);
  // The radio itself is visually hidden; people click its label.
  await page.getByText("LinkedIn 1200×627", { exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "LinkedIn 1200×627" }),
  ).toBeChecked();
  await expect(
    page.getByRole("img", { name: "Snapshot preview" }),
  ).toHaveAttribute("src", /width%3D%221200%22/);

  const png = await download(page, "Download PNG");

  expect(pngSize(png.bytes)).toEqual({ width: 2400, height: 1254 });
});

test("switches theme with the keyboard alone", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard flow is a desktop concern");
  await openWithExample(page);
  const latentDark = page.getByRole("radio", { name: "Latent Dark" });

  for (
    let i = 0;
    i < 40 &&
    !(await latentDark.evaluate((el) => el === document.activeElement));
    i++
  ) {
    await page.keyboard.press("Tab");
  }
  await expect(latentDark).toBeFocused();
  await page.keyboard.press("ArrowRight"); // Latent Light
  await page.keyboard.press("ArrowRight"); // Cyanotype
  await page.keyboard.press("ArrowRight"); // Paper

  await expect(page.getByRole("radio", { name: "Paper" })).toBeChecked();
  await expect(
    page.getByRole("img", { name: "Snapshot preview" }),
  ).toHaveAttribute("src", /%23ecebe6/);
});

test.describe("on a narrow screen", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("fits without horizontal scroll and shows the preview first", async ({
    page,
  }) => {
    await openWithExample(page);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const preview = await page
      .getByRole("img", { name: "Snapshot preview" })
      .boundingBox();
    const editor = await page
      .getByRole("textbox", { name: "Code snippet" })
      .boundingBox();
    expect(preview!.y).toBeLessThan(editor!.y);
  });
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("nothing animates", async ({ page }) => {
    await openWithExample(page);

    const running = await page.evaluate(
      () =>
        document.getAnimations().filter((a) => a.playState === "running")
          .length,
    );
    expect(running).toBe(0);
  });
});
