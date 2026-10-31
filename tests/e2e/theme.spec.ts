import { expect, test, type Page } from "@playwright/test";

const LIGHT_BG = "rgb(238, 241, 244)";
const DARK_BG = "rgb(18, 18, 28)";

async function bodyBackgroundAtFirstPaint(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

test.describe("theme", () => {
  test("follows a light OS preference on first paint", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    expect(await bodyBackgroundAtFirstPaint(page)).toBe(LIGHT_BG);
  });

  test("follows a dark OS preference on first paint", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    expect(await bodyBackgroundAtFirstPaint(page)).toBe(DARK_BG);
  });

  test("keeps a chosen theme across reloads", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    const toggle = page.getByRole("button", { name: /^theme:/i });

    await toggle.click(); // system -> light
    await toggle.click(); // light -> dark
    await expect(toggle).toHaveAccessibleName(/theme: dark/i);

    expect(await bodyBackgroundAtFirstPaint(page)).toBe(DARK_BG);
  });
});
