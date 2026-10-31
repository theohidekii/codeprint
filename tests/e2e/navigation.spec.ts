import { expect, test } from "@playwright/test";

const tools = ["Trace", "Snapshot", "Fingerprint", "Blueprint"];

test.describe("navigation", () => {
  test("each tool link opens its page", async ({ page, isMobile }) => {
    for (const name of tools) {
      await page.goto("/");
      if (isMobile)
        await page.getByRole("button", { name: "Open menu" }).click();
      const nav = page.getByRole("navigation", {
        name: isMobile ? "Menu" : "Primary",
      });

      await nav.getByRole("link", { name }).click();

      await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    }
  });

  for (const path of ["/nope", "/trace/whatever"]) {
    test(`unknown route ${path} shows the not found page`, async ({ page }) => {
      const response = await page.goto(path);

      expect(response?.status()).toBe(404);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "No match found",
      );
    });
  }

  test("keyboard users can skip to content and reach every control with a visible focus", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "keyboard flow is a desktop concern");
    await page.goto("/");

    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Skip to content" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();

    await page.goto("/");
    const expected = ["Skip to content", "Codeprint home", ...tools];
    for (const name of expected) {
      await page.keyboard.press("Tab");
      const focused = page.locator(":focus");
      await expect(focused).toHaveAccessibleName(name);
      const outline = await focused.evaluate(
        (el) => getComputedStyle(el).outlineStyle,
      );
      expect(outline, name).not.toBe("none");
    }
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toHaveAccessibleName(/^theme:/i);

    for (const name of ["Trace a snippet", "View on GitHub"]) {
      await page.keyboard.press("Tab");
      await expect(page.locator(":focus")).toHaveAccessibleName(name);
    }

    // Tool cards draw their focus ring on the card, not on the heading link inside it.
    for (const name of tools) {
      await page.keyboard.press("Tab");
      const focused = page.locator(":focus");
      await expect(focused).toHaveAccessibleName(name);
      const cardOutline = await focused.evaluate(
        (el) => getComputedStyle(el.closest("article")!).outlineStyle,
      );
      expect(cardOutline, `${name} card`).not.toBe("none");
    }
  });
});
