import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 360, height: 740 } });

for (const path of ["/", "/trace", "/snapshot", "/fingerprint", "/blueprint"]) {
  test(`${path} fits a 360px screen without horizontal scroll`, async ({
    page,
  }) => {
    await page.goto(path);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("narrow screens use the menu button instead of inline links", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeHidden();
});
