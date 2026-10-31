# Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A running, fully tested Codeprint shell. It includes tooling, CI, the design system, navigation to the four tools (placeholders) and a finished landing page, ready for Phase 2 (Trace) to plug into.

**Architecture:** One Next.js App Router app. Routes in `src/app` stay thin. Reusable UI lives in `src/shared/ui`, and each tool gets a folder in `src/features/<tool>`. The tool registry (`src/shared/lib/tools.ts`) is the single source of truth for tool names, slugs, taglines and status, and the nav, landing and placeholder pages read from it.

**Tech Stack:** Next.js (latest stable at scaffold time), React, TypeScript strict, pnpm, Tailwind CSS v4, shadcn/ui, `motion` (Framer Motion), `next-themes`, Zod, Vitest + Testing Library + jsdom, MSW, Playwright, ESLint + Prettier, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-31-codeprint-design.md`

## Global Constraints

- All code, comments, docs, UI copy and commit messages in **English**.
- TypeScript `strict: true` plus `noUncheckedIndexedAccess: true`. No `any` without an inline justification comment.
- Strict TDD: every behavior task writes the failing test first, runs it red, implements, runs it green, then commits.
- Conventional Commits. Every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Work on branch `phase-1-foundation`, merged to `main` through a PR when the phase is done. Never push straight to `main` after Task 1.
- Node 22 (`.nvmrc` = `22`). pnpm through corepack, version pinned in `package.json#packageManager`.
- Tests never hit the network (MSW `onUnhandledRequest: "error"`).
- No deploy config (owner's decision: not deployed).
- Accessibility: WCAG AA contrast in both themes, visible focus, and `prefers-reduced-motion` disables non-essential motion.
- Layout works from 360px wide with no horizontal scroll.
- `src/features/*/domain` must not import React, Next.js or anything under `ui/`, `providers/` or `app/`. This is enforced by an ESLint rule in Task 1.

## Review Focus

1. **Theme flash on first load.** A user with the light OS theme must never see a dark flash, and vice versa. Pinned by the e2e test in Task 6.
2. **Reduced motion.** With `prefers-reduced-motion: reduce`, hero and nav animations must not run, and content must still be visible (no stuck `opacity: 0`). Pinned in Task 8.
3. **Keyboard-only navigation.** Tab order reaches the skip link, nav, theme toggle and every tool card, with visible focus. Pinned in Task 7.
4. **Unknown routes.** `/trace/whatever` and `/nope` render the styled 404, not a crash. Pinned in Task 7.
5. **Narrow screens.** At 360×740 there is no horizontal scroll on `/` or any tool page, and the nav collapses into an accessible menu. Pinned in Task 8.

---

## File Structure

```
.github/workflows/ci.yml
.nvmrc  .prettierrc  .env.example  LICENSE  CONTRIBUTING.md  README.md
eslint.config.mjs  vitest.config.ts  vitest.setup.ts  playwright.config.ts
docs/adr/0001-stack-and-architecture.md
docs/design/direction-mockups/*.html          # Task 5 checkpoint output
src/
  env.ts                                      # Zod-validated env
  app/
    layout.tsx  page.tsx  not-found.tsx  globals.css
    (tools)/[tool]/page.tsx                   # placeholder per tool
  shared/
    lib/tools.ts  lib/cn.ts
    ui/button.tsx  ui/card.tsx  ui/badge.tsx  ui/kbd.tsx
    ui/theme-provider.tsx  ui/theme-toggle.tsx
    ui/site-header.tsx  ui/site-footer.tsx  ui/skip-link.tsx
    ui/fingerprint-mark.tsx                   # signature motif (SVG)
  features/landing/ui/hero.tsx  tool-grid.tsx  how-it-works.tsx
  test/msw/server.ts  test/msw/handlers.ts
tests/e2e/smoke.spec.ts  theme.spec.ts  navigation.spec.ts  responsive.spec.ts  motion.spec.ts
```

Co-located unit tests: `*.test.ts(x)` next to the file under test.

---

### Task 1: Scaffold, strict TypeScript, lint and unit test runner

**Files:**
- Create: the Next.js scaffold, `.nvmrc`, `.prettierrc`, `eslint.config.mjs`, `vitest.config.ts`, `vitest.setup.ts`, `src/shared/lib/cn.ts`, `src/shared/lib/cn.test.ts`
- Modify: `tsconfig.json`, `package.json`, `README.md` (keep the existing content), `.gitignore`

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string` (clsx + tailwind-merge). Scripts `dev`, `build`, `start`, `lint`, `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `test:watch`, `test:e2e`, `format`, `format:check`.

- [ ] **Step 1:** Scaffold in place: `pnpm dlx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --no-turbopack`. Keep `README.md` and `docs/`. Delete the boilerplate page content and images.
- [ ] **Step 2:** In `tsconfig.json`, set `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride` and `forceConsistentCasingInFileNames`. Add `packageManager` and `engines.node >=22`.
- [ ] **Step 3:** Install dev deps: `vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom vite-tsconfig-paths prettier prettier-plugin-tailwindcss eslint-config-prettier`. Configure Vitest with the jsdom environment, `vitest.setup.ts` importing `@testing-library/jest-dom/vitest`, an include of `src/**/*.test.{ts,tsx}`, and v8 coverage.
- [ ] **Step 4:** In ESLint, add `no-restricted-imports` scoped to `src/features/*/domain/**`. It forbids `react`, `next`, `next/*` and the patterns `**/ui/**`, `**/providers/**` and `@/app/**`.
- [ ] **Step 5: Write the failing test** `src/shared/lib/cn.test.ts`:

```ts
it("merges conflicting tailwind classes, last wins", () => {
  expect(cn("px-2 text-sm", "px-4")).toBe("text-sm px-4");
});
it("drops falsy values", () => {
  expect(cn("a", false, undefined, null, "b")).toBe("a b");
});
```

- [ ] **Step 6:** Run `pnpm test`. Expected: FAIL, `cn` not found.
- [ ] **Step 7:** Install `clsx tailwind-merge` and implement `cn` in `src/shared/lib/cn.ts`.
- [ ] **Step 8:** Run `pnpm test && pnpm lint && pnpm typecheck && pnpm format:check`. Expected: all pass.
- [ ] **Step 9:** Commit `chore: scaffold next.js app with strict typescript, lint and vitest` on `main`, push, then `git switch -c phase-1-foundation`.

### Task 2: Environment validation

**Files:**
- Create: `src/env.ts`, `src/env.schema.ts`, `src/env.schema.test.ts`, `.env.example`

**Interfaces:**
- Produces: `parseEnv(source: Record<string, string | undefined>): Env` and `env: Env` (parsed from `process.env` at import, server-only). `Env = { NODE_ENV: "development" | "test" | "production"; GITHUB_TOKEN?: string }`. Phase 2 makes `GITHUB_TOKEN` matter, but it stays optional at the schema level so the app runs without it.

- [ ] **Step 1: Write the failing tests:**
  - `parseEnv({ NODE_ENV: "test" })` returns `{ NODE_ENV: "test" }` with `GITHUB_TOKEN` undefined.
  - `parseEnv({ NODE_ENV: "test", GITHUB_TOKEN: "" })` treats the empty string as undefined.
  - `parseEnv({ NODE_ENV: "staging" })` throws an error whose message contains `NODE_ENV`.
- [ ] **Step 2:** Run `pnpm test src/env.schema.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement with Zod. Import `server-only` in `env.ts` (not in the parse function's test path: export `parseEnv` from `src/env.schema.ts` and have `env.ts` import it). Document `GITHUB_TOKEN` in `.env.example` ("Read-only token, needed from Phase 2 for Trace").
- [ ] **Step 4:** Run `pnpm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat: validate environment with zod`.

### Task 3: Network mocking and E2E harness

**Files:**
- Create: `src/test/msw/server.ts`, `src/test/msw/handlers.ts`, `src/test/msw/server.test.ts`, `playwright.config.ts`, `tests/e2e/smoke.spec.ts`
- Modify: `vitest.setup.ts`, `package.json`

**Interfaces:**
- Produces: `server` (msw/node `setupServer(...handlers)`), started in `vitest.setup.ts` with `onUnhandledRequest: "error"`, reset after each test and closed after all. `handlers: RequestHandler[]` (empty for now). Phase 2 adds to it.

- [ ] **Step 1: Write the failing test** `server.test.ts`: register `http.get("https://api.example.test/ping", () => HttpResponse.json({ ok: true }))` with `server.use`, then `fetch` it and expect `{ ok: true }`. A second test asserts that fetching an unhandled URL rejects.
- [ ] **Step 2:** Run it. Expected: FAIL (no server).
- [ ] **Step 3:** Install `msw`, implement the server, wire it into `vitest.setup.ts`.
- [ ] **Step 4:** Run `pnpm test`. Expected: PASS.
- [ ] **Step 5:** Install `@playwright/test` and Chromium. In the config, set `webServer` to `pnpm build && pnpm start` on port 3000 with `reuseExistingServer: !process.env.CI`, and use projects `chromium` and `mobile` (Pixel 7). Write `smoke.spec.ts`: visiting `/` gives a 200 and the page has an `h1`.
- [ ] **Step 6:** Run `pnpm test:e2e`. Expected: PASS (the scaffold page needs an `h1`; add a bare one if missing).
- [ ] **Step 7:** Commit `test: add msw network mocking and playwright e2e harness`.

### Task 4: Continuous integration

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1:** The workflow runs on `push` to `main` and on `pull_request`, on `ubuntu-latest` with Node from `.nvmrc`, using corepack pnpm with cache. Jobs: `quality` (format:check, lint, typecheck), `unit` (`pnpm test -- --coverage`, uploads the coverage artifact), `e2e` (installs Playwright Chromium with deps, runs `pnpm test:e2e`, uploads the report on failure). `e2e` needs `quality`.
- [ ] **Step 2:** Commit `ci: run quality, unit and e2e checks`, push the branch, open a draft PR `Phase 1: Foundation` and confirm all three jobs pass with `gh pr checks --watch`.
- [ ] **Step 3:** Protect `main` (spec §12) with `gh api -X PUT repos/theohidekii/codeprint/branches/main/protection`. Require the status checks `quality`, `unit` and `e2e`, require PRs, set `enforce_admins: false` (the owner can still bypass). Confirm with `gh api repos/theohidekii/codeprint/branches/main/protection`.

### Task 5: Visual direction checkpoint (owner gate)

**Files:**
- Create: `docs/design/direction-mockups/a.html`, `b.html`, `c.html`, `docs/design/visual-direction.md`

This is a gate. Tasks 6–9 do not start until the owner picks a direction.

- [ ] **Step 1:** Load the `frontend-design` skill. Build three static HTML mockups of the landing hero plus one tool card, each a distinct take on "forensic lab meets precision engineering". Each defines a display font, a mono font, a palette (dark and light), the signature accent, and how the fingerprint-ridge motif and grid lines appear. Fonts come from Google Fonts or `next/font` equivalents. Each must pass AA contrast.
- [ ] **Step 2:** Show them to the owner side by side and record their pick and any changes.
- [ ] **Step 3:** Write `visual-direction.md` with the chosen tokens: exact hex values per theme for `background`, `surface`, `surface-raised`, `border`, `text`, `text-muted`, `accent`, `accent-contrast`, `danger`, `success`, plus font families, type scale, radius and motion durations/easings.
- [ ] **Step 4:** Commit `docs: record visual direction`.

### Task 6: Design tokens and theming

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.tsx`
- Create: `src/shared/ui/theme-provider.tsx`, `src/shared/ui/theme-toggle.tsx`, `src/shared/ui/theme-toggle.test.tsx`, `tests/e2e/theme.spec.ts`

**Interfaces:**
- Consumes: the tokens from `docs/design/visual-direction.md`.
- Produces: CSS variables `--color-*`, `--font-display`, `--font-mono` exposed as Tailwind v4 `@theme` tokens (`bg-background`, `text-muted`, `text-accent`, `font-display`, …). `<ThemeProvider>` wraps `next-themes` with `attribute="class"`, `defaultTheme="system"`, `enableSystem`. `<ThemeToggle />` cycles system → light → dark.

- [ ] **Step 1: Write the failing tests** `theme-toggle.test.tsx` (mock `next-themes`' `useTheme`):
  - It renders a button with an accessible name containing the current mode (`"Theme: system"`).
  - Clicking calls `setTheme("light")` when the current mode is `system`, `"dark"` when it is `light`, and `"system"` when it is `dark`.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement the tokens in `globals.css` (`:root` for light, `.dark` for dark), load fonts with `next/font`, and implement the provider and toggle (icon swap with `motion`; no animation under reduced motion). Set `suppressHydrationWarning` on `<html>`.
- [ ] **Step 4:** Run the unit tests. Expected: PASS.
- [ ] **Step 5: Write the e2e test** `theme.spec.ts`. With `colorScheme: "light"`, the computed `background-color` of `body` equals the light `background` token on the **first paint** (read it in `page.evaluate` right after `domcontentloaded`), and likewise for dark. After clicking the toggle to `dark` and reloading, dark persists.
- [ ] **Step 6:** Run `pnpm test:e2e`. Expected: PASS.
- [ ] **Step 7:** Commit `feat: add design tokens and theme switching`.

### Task 7: Tool registry, shell, navigation and 404

**Files:**
- Create: `src/shared/lib/tools.ts`, `tools.test.ts`, `src/shared/ui/{button,card,badge,kbd,skip-link,site-header,site-footer,fingerprint-mark}.tsx`, `site-header.test.tsx`, `src/app/(tools)/[tool]/page.tsx`, `src/app/not-found.tsx`, `tests/e2e/navigation.spec.ts`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces:

```ts
export type ToolStatus = "available" | "coming-soon";
export type ToolSlug = "trace" | "snapshot" | "fingerprint" | "blueprint";
export interface Tool { slug: ToolSlug; name: string; tagline: string; description: string; status: ToolStatus; phase: 2 | 3 | 4 | 5 }
export const tools: readonly Tool[];
export function getTool(slug: string): Tool | undefined;
```

  The `[tool]` page uses `generateStaticParams` from `tools` and calls `notFound()` for unknown slugs. `Button` has variants `primary | secondary | ghost` and sizes `sm | md | lg` (shadcn base, restyled to the tokens).

- [ ] **Step 1: Write the failing tests** `tools.test.ts`:
  - `tools.map(t => t.slug)` equals `["trace", "snapshot", "fingerprint", "blueprint"]`, in that order (the spec's build order).
  - The phases are `2, 3, 4, 5` respectively. All statuses are `"coming-soon"` in Phase 1.
  - `getTool("trace")?.name` is `"Trace"`, and `getTool("nope")` is `undefined`.
  - Every tagline is ≤ 60 characters and every description ≤ 160 (they must fit the cards).
- [ ] **Step 2:** Run it. Expected: FAIL. Implement `tools.ts` with the copy from spec §2. Run it. Expected: PASS.
- [ ] **Step 3: Write the failing tests** `site-header.test.tsx`:
  - The header renders a `nav` landmark named `"Primary"` with one link per tool, pointing to `/<slug>`.
  - The link for the current path has `aria-current="page"` (mock `usePathname`).
  - Below the `md` breakpoint, the menu button has `aria-expanded="false"`, toggles to `"true"` on click, and closes on `Escape` with focus returned to the button.
- [ ] **Step 4:** Run it. Expected: FAIL. Implement the shared UI and the header. Run it. Expected: PASS.
- [ ] **Step 5:** Implement the placeholder tool page: tool name, tagline, a "Coming in Phase N" badge, a link back home, and the fingerprint motif. Implement the styled `not-found.tsx` ("No match found" in the forensic voice, with a link home). Add a skip link targeting `#main`.
- [ ] **Step 6: Write the e2e test** `navigation.spec.ts`:
  - Clicking each nav link loads the tool page with an `h1` equal to the tool name.
  - `/trace/whatever` and `/nope` return 404 and show the "No match found" heading.
  - Keyboard: the first `Tab` focuses the skip link, `Enter` moves focus to `main`, and further tabs reach every nav link and the theme toggle. Each focused element has a non-`none` `outline` or `box-shadow`.
- [ ] **Step 7:** Run `pnpm test && pnpm test:e2e`. Expected: PASS.
- [ ] **Step 8:** Commit `feat: add tool registry, site shell and navigation`.

### Task 8: Landing page

**Files:**
- Create: `src/features/landing/ui/{hero,tool-grid,how-it-works}.tsx` with `*.test.tsx`, `tests/e2e/responsive.spec.ts`, `tests/e2e/motion.spec.ts`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `tools` and `Tool` (Task 7), the shared UI and the tokens.
- Produces: `<Hero />`, `<ToolGrid tools={readonly Tool[]} />`, `<HowItWorks />`.

The spec's "live Trace demo above the fold" needs Trace, so Phase 1 ships the static illustration and Phase 2 swaps in the live demo.

Copy (exact):
- Hero `h1`: **"The fingerprint of code."**
- Hero subhead: **"Trace a snippet back to its source, even after the variables were renamed. Then turn code into something worth sharing."**
- Primary CTA: **"Trace a snippet"** → `/trace`. Secondary CTA: **"View on GitHub"** → `https://github.com/theohidekii/codeprint`.
- How it works, three steps: **"Tokenize"**, **"Normalize"**, **"Fingerprint"**, each with one sentence explaining spec §7.2 steps 1–3 in plain words.

- [ ] **Step 1: Write the failing tests:**
  - `hero.test.tsx`: the `h1` text matches exactly, the CTAs are links with the exact names and hrefs, and the GitHub link has `rel` containing `noopener`.
  - `tool-grid.test.tsx`: given `tools`, it renders 4 `article`s, each with the tool name as a heading, the tagline, a status badge reading "Coming soon", and a link to `/<slug>`. Given an empty array, it renders nothing (no empty grid).
  - `how-it-works.test.tsx`: it renders an ordered list with 3 items, in order Tokenize, Normalize, Fingerprint.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement per the visual direction. The hero contains an animated fingerprint-ridge SVG "scan" built with `motion`, plus a static code-to-fingerprint illustration. Tool cards get a hover/focus lift and staggered reveal on scroll. Every animation goes through a `useReducedMotion()` guard that renders final states immediately.
- [ ] **Step 4:** Run the unit tests. Expected: PASS.
- [ ] **Step 5: Write the e2e tests:**
  - `responsive.spec.ts`: at viewport 360×740, for `/` and each `/<slug>`, `document.documentElement.scrollWidth <= window.innerWidth`, and the menu button is visible while desktop nav links are hidden.
  - `motion.spec.ts`: with `reducedMotion: "reduce"`, the hero `h1` and all 4 tool cards have computed `opacity: "1"` within 100ms of load, and no element has a running animation (`document.getAnimations().filter(a => a.playState === "running").length === 0`).
- [ ] **Step 6:** Run `pnpm test:e2e`. Expected: PASS.
- [ ] **Step 7:** Commit `feat: build landing page`.

### Task 9: Documentation and phase wrap-up

**Files:**
- Create: `CONTRIBUTING.md`, `LICENSE` (MIT, `Copyright (c) 2026 Theo Hideki`), `docs/adr/0001-stack-and-architecture.md`
- Modify: `README.md`

- [ ] **Step 1:** In `README.md`, add the pitch, a landing screenshot in both themes (`docs/assets/landing-dark.png`, `landing-light.png`, captured with Playwright), the four tools with a status table, quick start (`corepack enable`, `pnpm install`, `cp .env.example .env.local`, `pnpm dev`), scripts, the project structure, the testing approach and the license. Note that the project is intentionally not deployed and runs locally.
- [ ] **Step 2:** In `CONTRIBUTING.md`, cover the red/green/refactor workflow, where tests live, the domain import rule, Conventional Commits and the branch/PR flow.
- [ ] **Step 3:** The ADR 0001 records the stack, the feature-folder architecture, the domain purity rule and the no-deploy decision, with context and consequences.
- [ ] **Step 4:** Run `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm build`. Expected: all pass.
- [ ] **Step 5:** Commit `docs: add readme, contributing guide, license and adr`, push, mark the PR ready, confirm CI is green, and ask the owner before merging into `main`.
