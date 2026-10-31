import { expect, test } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

test("with reduced motion, content is visible at once and nothing animates", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveCSS(
    "opacity",
    "1",
  );
  for (const card of await page.getByRole("article").all()) {
    await expect(card).toHaveCSS("opacity", "1");
  }
  const running = await page.evaluate(
    () =>
      document.getAnimations().filter((a) => a.playState === "running").length,
  );
  expect(running).toBe(0);
});

test("with reduced motion, the fingerprint is fully developed on load", async ({
  page,
}) => {
  await page.goto("/");

  const develop = page.locator("#developed circle");

  await expect(develop).toHaveAttribute("r", "240");
  await expect(develop).toHaveCSS("transform", "none");
});
