import { expect, test, type Page } from "@playwright/test";

// The server runs with CODEPRINT_E2E_MOCKS=1, so searches hit offline fixtures.
// Each test gets its own client address so the per-client rate limit never interferes.
test.beforeEach(async ({ page }, testInfo) => {
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `198.51.100.${(testInfo.workerIndex * 37 + testInfo.retry * 7 + Date.now()) % 250}`,
  });
});

async function traceExample(page: Page) {
  await page.goto("/trace");
  await page.getByRole("button", { name: "Try an example" }).click();
  await page.getByRole("button", { name: "Trace", exact: true }).click();
}

test("traces the example to a renamed copy and compares them", async ({
  page,
}) => {
  await traceExample(page);

  const card = page.getByRole("article").first();
  await expect(card).toBeVisible();
  await expect(card.getByRole("heading")).toHaveText("acme/timing-kit");
  const similarity = Number(
    await card.getByRole("meter").getAttribute("aria-valuenow"),
  );
  expect(similarity).toBeGreaterThanOrEqual(80);
  await expect(card.getByText("Also found in 1 other copy")).toBeVisible();
  await expect(
    card.getByRole("link", { name: "Open on GitHub" }),
  ).toBeVisible();

  await card.getByRole("button", { name: "Compare" }).click();

  await expect(card.getByText("fn → callback")).toBeVisible();
  await expect(
    card.getByRole("region", { name: "Your snippet" }),
  ).toBeVisible();
});

test("refuses a snippet that is too short", async ({ page }) => {
  await page.goto("/trace");
  await page.getByRole("textbox", { name: "Code snippet" }).fill("let a = 1;");

  await page
    .getByRole("textbox", { name: "Code snippet" })
    .press("Control+Enter");

  // Next.js adds its own route announcer with role="alert", so match ours by text.
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "This snippet is too short to trace." }),
  ).toHaveText(
    "This snippet is too short to trace. Paste a few lines, at least 20 tokens.",
  );
});

test("works with the keyboard alone", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard flow is a desktop concern");
  await page.goto("/trace");
  const editor = page.getByRole("textbox", { name: "Code snippet" });

  for (
    let i = 0;
    i < 20 && !(await editor.evaluate((el) => el === document.activeElement));
    i++
  ) {
    await page.keyboard.press("Tab");
  }
  await expect(editor).toBeFocused();
  await page.keyboard.type(
    "function debounce(fn, ms) {\nlet timer;\nreturn (...args) => {\nclearTimeout(timer);\ntimer = setTimeout(() => fn(...args), ms);\n};\n}",
  );
  await page.keyboard.press("Control+Enter");

  await expect(page.getByRole("status")).toHaveText(/match(es)? found/);
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("nothing animates while tracing", async ({ page }) => {
    await traceExample(page);

    const running = await page.evaluate(
      () =>
        document.getAnimations().filter((a) => a.playState === "running")
          .length,
    );
    expect(running).toBe(0);
    await expect(page.getByRole("article").first()).toBeVisible();
  });
});

test.describe("on a narrow screen", () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test("expanded results fit without horizontal scroll", async ({ page }) => {
    await traceExample(page);
    await page.getByRole("button", { name: "Compare" }).first().click();
    await expect(
      page.getByRole("region", { name: "Your snippet" }),
    ).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
