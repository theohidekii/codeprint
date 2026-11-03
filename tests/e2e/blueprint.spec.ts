import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

// The server runs with CODEPRINT_E2E_MOCKS=1, so GitHub is replaced by offline fixtures.
test.beforeEach(async ({ page }, testInfo) => {
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `198.51.102.${(testInfo.workerIndex * 37 + Date.now()) % 250}`,
  });
});

const PLAN = "Floor plan of vercel/swr";

async function openExample(page: Page) {
  await page.goto("/blueprint");
  // The button is in the server HTML before React hydrates, so retry until it takes effect.
  await expect(async () => {
    await page.getByRole("button", { name: "Try an example" }).click();
    await expect(page.getByRole("img", { name: PLAN })).toBeVisible({
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

test("generates the example and downloads the plan", async ({ page }) => {
  await openExample(page);

  expect(await pngSize(page)).toEqual({
    name: "vercel-swr.png",
    signature: "PNG",
    width: 3200,
    height: 2000,
  });
});

test("downloads a LinkedIn-sized plan", async ({ page }) => {
  await openExample(page);
  await page.getByText("LinkedIn 1200×627", { exact: true }).click();
  await expect(page.getByRole("img", { name: PLAN })).toHaveAttribute(
    "src",
    /width%3D%221200%22/,
  );

  expect(await pngSize(page)).toMatchObject({ width: 2400, height: 1254 });
});

test("says when a repository doesn't exist", async ({ page }) => {
  await page.goto("/blueprint");
  const input = page.getByRole("textbox", { name: "GitHub repository" });

  await expect(async () => {
    await input.fill("nobody/nothing");
    await input.press("Enter");
    await expect(
      page.getByRole("alert").filter({ hasText: "No public GitHub user" }),
    ).toBeVisible({ timeout: 1000 });
  }).toPass();
});

test("works with the keyboard alone", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard flow is a desktop concern");
  await openExample(page);
  const viewer = page.getByRole("group", { name: "Floor plan viewer" });
  await viewer.focus();
  await page.getByRole("button", { name: "Zoom in" }).press("Enter");
  await viewer.focus();

  await page.keyboard.press("ArrowRight");

  await expect(viewer).not.toHaveAttribute("data-pan", "0,0");
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
