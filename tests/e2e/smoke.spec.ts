import { expect, test } from "@playwright/test";

test("home page responds and has a top-level heading", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
