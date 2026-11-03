import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

// The server runs with CODEPRINT_E2E_MOCKS=1, so GitHub is replaced by offline fixtures.
test.beforeEach(async ({ page }, testInfo) => {
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `198.51.101.${(testInfo.workerIndex * 37 + Date.now()) % 250}`,
  });
});

const POSTER = "Poster for vercel/next.js";

async function openExample(page: Page) {
  await page.goto("/fingerprint");
  // The button is in the server HTML before React hydrates, so retry until it takes effect.
  await expect(async () => {
    await page.getByRole("button", { name: "Try an example" }).click();
    await expect(page.getByRole("img", { name: POSTER })).toBeVisible({
      timeout: 1000,
    });
  }).toPass();
}

async function pngSize(page: Page) {
  const [file] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download PNG" }).click(),
  ]);
  const bytes = await readFile((await file.path())!);
  return {
    name: file.suggestedFilename(),
    signature: bytes.subarray(1, 4).toString("ascii"),
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

test("generates the example and downloads a portrait poster", async ({
  page,
}) => {
  await openExample(page);

  expect(await pngSize(page)).toEqual({
    name: "vercel-next-js.png",
    signature: "PNG",
    width: 2160,
    height: 2700,
  });
});

test("downloads a landscape poster", async ({ page }) => {
  await openExample(page);
  await page.getByText("Landscape 1200×627", { exact: true }).click();
  await expect(page.getByRole("img", { name: POSTER })).toHaveAttribute(
    "src",
    /width%3D%221200%22/,
  );

  expect(await pngSize(page)).toMatchObject({ width: 2400, height: 1254 });
});

test("says when an account doesn't exist", async ({ page }) => {
  await page.goto("/fingerprint");
  const input = page.getByRole("textbox", {
    name: "GitHub user or repository",
  });

  await expect(async () => {
    await input.fill("nobody-here");
    await input.press("Enter");
    await expect(
      page.getByRole("alert").filter({ hasText: "No public GitHub user" }),
    ).toBeVisible({ timeout: 1000 });
  }).toPass();
});

test("works with the keyboard alone", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard flow is a desktop concern");
  await page.goto("/fingerprint");
  const input = page.getByRole("textbox", {
    name: "GitHub user or repository",
  });
  await input.focus();

  await expect(async () => {
    await input.fill("vercel/next.js");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("img", { name: POSTER })).toBeVisible({
      timeout: 1000,
    });
  }).toPass();

  const png = page.getByRole("button", { name: "Download PNG" });
  for (
    let i = 0;
    i < 30 && !(await png.evaluate((el) => el === document.activeElement));
    i++
  ) {
    await page.keyboard.press("Tab");
  }
  await expect(png).toBeFocused();
});

test.describe("on a narrow screen", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("fits without horizontal scroll", async ({ page }) => {
    await openExample(page);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("nothing animates", async ({ page }) => {
    await openExample(page);

    const running = await page.evaluate(
      () =>
        document.getAnimations().filter((a) => a.playState === "running")
          .length,
    );
    expect(running).toBe(0);
  });
});
