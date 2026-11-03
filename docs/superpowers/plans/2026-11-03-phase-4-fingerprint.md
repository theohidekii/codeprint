# Phase 4 — Fingerprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At `/fingerprint`, enter a GitHub user or repository and export a poster with a unique fingerprint drawn deterministically from its public activity.

**Architecture:**

- A thin route fetches and normalizes GitHub data into a `Profile`.
- Pure domain functions map `Profile` → `Traits` → `PosterModel` → SVG string.
- The client reuses the PNG, SVG and clipboard export code from Snapshot.

**Tech Stack:** As in earlier phases. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-03-fingerprint-design.md` (wins where more specific) and `docs/superpowers/specs/2026-10-31-codeprint-design.md` §8.

## Global Constraints

- Everything from the earlier phases' Global Constraints still applies: English, strict TS, TDD, Conventional Commits with the co-author line, branch plus PR, no network in tests, AA contrast for text, reduced motion, 360px.
- Branch: `phase-4-fingerprint`. Merge only after the owner approves.
- Run `pnpm typecheck` and `pnpm lint` before every commit.
- Exact values:
  - target regex `^[A-Za-z0-9-]{1,39}(/[A-Za-z0-9._-]{1,100})?$`
  - 20 requests per minute per client
  - 8000 ms per GitHub request
  - cache of 50 entries for 600000 ms
  - top 5 languages + "Other"
  - ridge count 14–34
  - sizes: portrait 1080×1350, square 1080×1080, landscape 1200×627
- UI copy exactly as in the addendum §3, §5 and §6.

## Review Focus

1. **Hostile or odd input:** `../../etc`, `a/b/c`, `user?x=1`, an empty string, or 200 characters get a `400` and never build a GitHub URL. Pinned in Task 3.
2. **Sparse accounts:** no repositories, no events, `language: null` everywhere, or an empty repository (`409` on commits) still give a valid poster. Pinned in Tasks 2, 3 and 5.
3. **Determinism:** the same profile gives byte-identical SVG. Different names give different SVG. No `Math.random` or `Date.now` in the domain. Pinned in Tasks 4 and 5.
4. **Injection through GitHub data:** language and repository names with `<`, `&` or quotes render as text. Pinned in Task 5.
5. **Rate limits:** GitHub's `403` with `x-ratelimit-remaining: 0`, or a `429`, shows the exact message and is not cached. Pinned in Task 3.

---

## File Structure

```
src/shared/lib/ridges.ts                 (moved from features/landing/lib)
src/shared/lib/export/{fonts,png,files}.ts (moved from features/snapshot/export)
src/shared/server/{rate-limit,cache}.ts  (moved from features/trace/server, cache made generic)
src/features/fingerprint/
  domain/
    profile.ts     Profile type, summarizeTimestamps(), topLanguages(), emptyProfile()
    random.ts      seededRandom(seed)
    traits.ts      deriveTraits(profile) → Traits
    print.ts       buildPrint(traits) → ridge paths (loop, whorl, arch)
    palettes.ts    per-theme language colors
    poster.ts      layoutPoster(profile, traits, options) → PosterModel
    render-poster.ts  renderPoster(model, theme, fonts) → SVG string
  server/
    github.ts      fetchProfile(target, deps) → Profile
  ui/
    fingerprint-view.tsx  use-fingerprint.ts  poster-options.tsx
src/app/api/fingerprint/route.ts
src/app/(tools)/fingerprint/page.tsx     (replaces the placeholder)
src/test/msw/github-handlers.ts
tests/e2e/fingerprint.spec.ts
```

---

### Task 1: Move shared code

**Files:** Move the files listed in File Structure with `git mv`, including their tests. Update imports in Landing, Trace, Snapshot and `route.ts`.

**Interfaces (Produces):**

- `createCache<T>({ max, ttlMs, now? })`, generic over the value (Trace keeps using it with `TraceEvent[]`).
- `createRateLimiter` unchanged.
- `filenameFor(title: string, fallback: string, ext: "png" | "svg"): string` replaces `snapshotFilename` (Snapshot passes `codeprint-<language>` as the fallback; its tests adapt).
- `fonts`, `png` and `files` otherwise keep their exact signatures.

- [ ] **Step 1:** Move the files and update imports. Rename `createTraceCache` to `createCache<T>` and `snapshotFilename` to `filenameFor`. In the moved test, assert `filenameFor("My Debounce!", "codeprint-go", "png")` is `my-debounce.png` and `filenameFor("", "codeprint-go", "svg")` is `codeprint-go.svg`.
- [ ] **Step 2:** Run `pnpm test && pnpm typecheck && pnpm lint`. Expected: all pass, with the same test count as before this task.
- [ ] **Step 3:** Commit `refactor: move code shared between tools to src/shared`.

### Task 2: Profile

**Files:** `domain/profile.ts` with its test

**Interfaces (Produces):**

```ts
export interface LanguageShare {
  name: string;
  share: number;
}
export interface Profile {
  kind: "user" | "repo";
  name: string;
  languages: LanguageShare[];
  hours: number[];
  weekdays: number[];
  sizes: { count: number; median: number };
  stars: number;
  sampled: number;
}
export function summarizeTimestamps(isoDates: readonly string[]): {
  hours: number[];
  weekdays: number[];
  sampled: number;
};
export function topLanguages(
  weights: Readonly<Record<string, number>>,
): LanguageShare[];
export function median(values: readonly number[]): number;
```

- [ ] **Step 1: Write the failing tests:**
  - `summarizeTimestamps(["2026-11-02T14:05:00Z", "2026-11-02T14:50:00Z", "2026-11-01T23:59:00Z"])`: `hours[14]` is 2, `hours[23]` is 1, `weekdays[1]` (Monday) is 2, `weekdays[0]` (Sunday) is 1, `sampled` is 3, and both arrays have lengths 24 and 7.
  - Invalid dates are skipped and not counted in `sampled`. Empty input gives all zeros.
  - `topLanguages`: 7 languages give the top 5 by weight plus `"Other"` holding the remainder, shares sum to 1 (within 1e-9), sorted by share with Other last. Exactly 5 or fewer gives no Other. Empty or all-zero gives `[]`.
  - `median([3,1,2])` is 2, `median([1,2,3,4])` is 2.5, `median([])` is 0.
- [ ] **Step 2–5:** RED, implement, GREEN, commit `feat(fingerprint): summarize public activity into a profile`.

### Task 3: GitHub fetching and the route

**Files:** `server/github.ts`, `src/app/api/fingerprint/route.ts`, `src/test/msw/github-handlers.ts` with tests. Add the handlers to `src/instrumentation.ts`.

**Interfaces (Produces):**

```ts
export class ProfileError extends Error { constructor(public code: "not-found" | "rate-limited" | "unavailable", message: string) }
export const TARGET = /^[A-Za-z0-9-]{1,39}(\/[A-Za-z0-9._-]{1,100})?$/;
export function fetchProfile(target: string, deps: { token?: string; fetch?: typeof fetch; signal?: AbortSignal; timeoutMs?: number }): Promise<Profile>;
```

- [ ] **Step 1: Write the failing tests** (MSW):
  - **User:** requests `/users/x`, `/users/x/repos?per_page=100&sort=pushed` and `/users/x/events/public?per_page=100`. The profile has `kind: "user"`, languages weighted by repo `size` (repos with a null language are ignored, forks excluded), `stars` summed, `sizes.count` = repos, `sizes.median` in KB, and hours from event `created_at`.
  - **Repo:** requests the four repo endpoints. Languages come from bytes, `stars` from the repo, `sizes` from blob entries in the tree (`type: "blob"`), and hours from `commit.author.date`.
  - The `Authorization: Bearer` header is present only when a token is given.
  - **Partial:** events or commits failing (`500`, or `409` on an empty repo) or an empty tree still resolve with zeros. The first request failing rejects.
  - **Errors:** `404` on the first request rejects with `ProfileError("not-found")`, `403` with `x-ratelimit-remaining: 0` or `429` on any request with `"rate-limited"`, and `500` or a timeout on the first request with `"unavailable"`. Malformed JSON shapes (Zod) count as missing data, never a crash.
  - **Route:**
    - `?target=../../etc`, `?target=a/b/c`, `?target=user%3Fx=1`, no target, and 200 characters each get `400` with `{ error: "invalid-target" }`, and MSW sees no request.
    - Success gets `200` JSON.
    - `not-found` gets `404` and `rate-limited` gets `429`, each with the addendum's exact message.
    - The 21st request from a client within a minute gets `429`.
    - A repeated target (in different letter case) is served from the cache, and errors are not cached.
- [ ] **Step 2–5:** RED, implement, GREEN, commit `feat(fingerprint): fetch github profiles`.

### Task 4: Seeded traits

**Files:** `domain/random.ts`, `domain/traits.ts` with tests

**Interfaces (Produces):**

```ts
export function seededRandom(seed: string): () => number; // mulberry32 seeded with fnv1a(seed); values in [0, 1)
export type PrintPattern = "loop" | "whorl" | "arch";
export interface Traits {
  seed: string;
  pattern: PrintPattern;
  core: { x: number; y: number }; // offset from center, within ±24
  ridgeCount: number; // 14–34, log scale of sizes.count (0 → 14, 100000+ → 34)
  wobble: number; // 0.4–5, from the coefficient of variation of weekdays
  bands: { name: string; share: number }[]; // the profile's languages, or [] when none
  ring: number[]; // 24 values in 0–1, hours normalized by the max
  peakHour: number | null;
  quiet: boolean; // sampled === 0 && languages empty
}
export function deriveTraits(profile: Profile): Traits;
```

The seed is the lowercased name. Import `fnv1a` from `@/features/trace/domain/winnow`.

- [ ] **Step 1: Write the failing tests:**
  - `seededRandom("a")` gives the same sequence twice, values stay in [0, 1), and `seededRandom("b")` differs.
  - `deriveTraits` is deterministic, including for `Name` versus `name`.
  - Across 200 generated names, all three patterns appear, and `core` stays within ±24.
  - `ridgeCount` is 14 at count 0, 34 at 100000 and above, and grows with count.
  - `wobble` is lowest for even weekdays and higher when all activity is on one day, and always within 0.4–5.
  - `ring` is normalized (max is 1) and all zeros with no activity. `peakHour` is the max hour, or null.
  - `quiet` is true for an empty profile.
- [ ] **Step 2–5:** RED, implement, GREEN, commit `feat(fingerprint): derive traits from a profile`.

### Task 5: Print geometry and the poster

**Files:** `domain/print.ts`, `domain/palettes.ts`, `domain/poster.ts`, `domain/render-poster.ts` with tests

**Interfaces (Produces):**

```ts
export interface PrintRidge {
  id: string;
  d: string;
  band: number;
} // band indexes traits.bands, -1 for no language
export function buildPrint(traits: Traits): PrintRidge[]; // in a coordinate box of ±170 × ±210
export type PosterSize = "portrait" | "square" | "landscape";
export interface PosterOptions {
  theme: SnapshotThemeId;
  size: PosterSize;
}
export interface PosterModel {
  width: number;
  height: number;
  print: { cx: number; cy: number; scale: number };
  ridges: PrintRidge[];
  ring: { angle: number; length: number }[];
  title: { text: string; fontSize: number; x: number; y: number };
  facts: string[];
  legend: { name: string; percent: number; color: string }[];
  note: string | null;
}
export function layoutPoster(
  profile: Profile,
  traits: Traits,
  options: PosterOptions,
): PosterModel;
export function bandColor(themeId: SnapshotThemeId, band: number): string;
export function renderPoster(
  model: PosterModel,
  theme: SnapshotTheme,
  fonts?: EmbeddedFonts,
): string;
```

- [ ] **Step 1: Write the failing tests:**
  - `buildPrint` returns exactly `ridgeCount` ridges, is deterministic, and each `pattern` gives different geometry. Every `d` matches the `M… L…` path grammar, and all coordinates stay within the box.
  - Band assignment is proportional: with shares 0.75/0.25 and 20 ridges, 15 and 5 ridges (±1). With no bands, all are `-1`.
  - Higher `wobble` gives more deviation from the base geometry.
  - **Palettes:** for every poster theme, each of the 6 colors reaches 3:1 against `theme.background` (name the theme and color in the failure message).
  - **`layoutPoster`:**
    - `width` and `height` match each size.
    - 24 ring entries, each with `length` proportional to the trait.
    - `facts` include `12.4K stars`, `TypeScript 68%` and `peak 14:00 UTC`, and omit whatever is missing.
    - A 60-character name gets a smaller `fontSize` than a short name and still fits: `text.length * fontSize * 0.6` ≤ width minus margins.
    - `note` is `"Not much public activity yet."` only when `traits.quiet`.
  - **`renderPoster`:**
    - It parses with no `parsererror`.
    - It is byte-identical across two runs. Different names differ.
    - `<script>` in a language or the name appears as text with no script element.
    - Lone surrogates don't throw in `encodeURIComponent`.
    - With fonts, there are two `@font-face` rules.
    - The title uses the sans font, and the print paths use the band colors.
    - The `codeprint` mark is present.
- [ ] **Step 2–5:** RED, implement (reuse Snapshot's escaping by moving `escapeXml` to `src/shared/lib/xml.ts`), GREEN, commit `feat(fingerprint): draw the print and the poster`.

### Task 6: UI

**Files:** `ui/use-fingerprint.ts`, `ui/poster-options.tsx`, `ui/fingerprint-view.tsx` with tests. Modify `src/app/(tools)/fingerprint/page.tsx`, `src/shared/lib/tools.ts` and its test.

**Interfaces (Produces):** `useFingerprint(): { state: "idle" | "loading" | "done" | "error"; profile: Profile | null; error: string | null; generate(target: string): void }`. It aborts the previous request and maps the API's error messages.

- [ ] **Step 1: Write the failing tests** (MSW for the API, mock `loadEmbeddedFonts` and `svgToPngBlob`):
  - The input is labelled "GitHub user or repository". Generate is disabled when it's empty, and Enter submits.
  - "Try an example" fills `vercel/next.js` and generates.
  - An invalid target shows an inline message without a request: "Enter a GitHub username or owner/repo."
  - While loading, a `role="status"` says "Reading public activity…". When done, the preview `img` named "Poster for <name>" shows.
  - Theme and Size are radio groups, and changing them updates the preview without a new request (count MSW calls).
  - API errors appear in `role="alert"` with the exact message.
  - "How to read it" lists the four mappings in §3.
  - A PNG failure shows "Couldn't create the image. Try again.", and Copy passes a promise.
  - Export filenames come from the name: `vercel/next.js` gives `vercel-next-js.png`.
  - Registry: Fingerprint is `available`.
- [ ] **Step 2–5:** RED, implement, GREEN, commit `feat(fingerprint): build the fingerprint page`.

### Task 7: End-to-end, docs and wrap-up

**Files:** Create `tests/e2e/fingerprint.spec.ts`, `docs/assets/fingerprint-example.png` and `docs/adr/0004-fingerprint-mapping.md`. Modify `README.md`.

- [ ] **Step 1: Write the e2e tests** (mocked GitHub):
  - The example generates a poster, and the PNG download is 2160×2700 with a valid signature.
  - Landscape downloads at 2400×1254.
  - A missing user shows the not-found message.
  - The keyboard-only flow works: type, Enter, tab to the export buttons.
  - 360px has no horizontal scroll. Reduced motion has no running animations.
- [ ] **Step 2:** Run `pnpm test:e2e`. Expected: PASS.
- [ ] **Step 3:** Live check against the real GitHub API with `vercel/next.js`, and look at the result. Fix anything it reveals, test-first.
- [ ] **Step 4:** Docs: a README section with an exported poster, "How to read it", the optional token and limits. ADR 0004 records the mapping and the deterministic seed.
- [ ] **Step 5:** Run `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm build`. Expected: all pass.
- [ ] **Step 6:** Commit `docs: document fingerprint`, push, open the PR `Phase 4: Fingerprint`, run the final whole-branch review, fix Critical and Important findings test-first, and ask the owner before merging.
