# Phase 3 — Snapshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At `/snapshot`, paste code and export a polished image (PNG at 2×, SVG, or copied to the clipboard) with themes, frames, highlighted lines, a caption and social-media sizes.

**Architecture:**

- Shiki (`shiki/core` with the JavaScript regex engine and only our 11 languages) colors the tokens.
- A pure layout function turns colored lines plus options into a `SnapshotModel` with absolute positions.
- A pure renderer turns the model into an SVG string with embedded fonts.
- The browser draws that SVG onto a canvas for PNG.
- The UI holds options in a reducer and re-renders the preview live.

**Tech Stack:** As in Phases 1–2, plus `shiki` (4.x). No server code.

**Spec:** `docs/superpowers/specs/2026-10-31-snapshot-design.md` (wins where more specific) and `docs/superpowers/specs/2026-10-31-codeprint-design.md` §8.

## Global Constraints

- Everything from the earlier phases' Global Constraints still applies: English, strict TS, TDD, Conventional Commits with the co-author line, branch plus PR, no network in tests, AA contrast, reduced motion, 360px.
- Branch: `phase-3-snapshot`. Open the PR into `main`; auto-merge is enabled, so **turn it on only after the owner approves the merge**.
- `src/features/snapshot/domain/` stays pure (the ESLint rule already enforces this). Shiki lives in `highlight/`, and browser APIs (canvas, clipboard, fetch of fonts) live in `export/`.
- Exact values:
  - code font size 16
  - line height 1.6 (25.6px)
  - `MAX_LINES = 80`, `MAX_COLUMNS = 120`
  - outer padding: compact 32, comfortable 56, spacious 88
  - card inner padding 28
  - window bar height 44
  - gutter gap 20
  - dimmed opacity 0.45
  - sizes: linkedin 1200×627, square 1080×1080
  - PNG scale 2
  - tab width 2
- UI copy exactly as in addendum §3 and §5.

## Review Focus

1. **XML injection:** code containing `<`, `&`, `]]>`, `"` or `</svg>` must render as text, never break or inject markup. Pinned in Task 4.
2. **Huge input:** 5,000 lines or a 50,000-character line must be truncated to the caps quickly (under 100 ms for layout) and say so. Pinned in Task 3.
3. **Unicode and wide characters:** emoji and CJK are wider than one monospace cell. Columns are counted in UTF-16 code points with emoji or wide ranges as 2 cells, so text never overlaps the card edge. Pinned in Task 3.
4. **Empty and whitespace-only input:** shows the placeholder, and exports are disabled. Pinned in Task 7.
5. **Clipboard unsupported or denied:** shows "Copy isn't available in this browser. Download the PNG instead." and never throws. Pinned in Task 6.

---

## File Structure

```
public/fonts/FragmentMono-Regular.woff2  public/fonts/SchibstedGrotesk-Bold.woff2  public/fonts/OFL.txt
src/features/snapshot/
  domain/
    options.ts        SnapshotOptions, defaults, reducer
    themes.ts         SnapshotTheme definitions (+ Shiki theme objects)
    layout.ts         layoutSnapshot() → SnapshotModel
    render-svg.ts     renderSvg() → string
    text-width.ts     cellWidth(char), columns(text)
  highlight/
    highlight.ts      highlight(code, language, theme) → ColoredLine[] (Shiki core, lazy singleton)
  export/
    fonts.ts          loadEmbeddedFonts() → EmbeddedFonts (data URLs)
    png.ts            svgToPngBlob()
    files.ts          downloadBlob(), copyPngToClipboard()
  ui/
    snapshot-view.tsx  options-panel.tsx  snapshot-preview.tsx  use-snapshot.ts
src/app/(tools)/snapshot/page.tsx   (replaces the placeholder)
tests/e2e/snapshot.spec.ts
```

---

### Task 1: Fonts, character metrics and themes

**Files:**

- Create: `public/fonts/*` (download Fragment Mono Regular and Schibsted Grotesk Bold, Latin subset woff2, from the Google Fonts CSS API, plus `OFL.txt`)
- Create: `domain/text-width.ts`, `domain/themes.ts` and their tests

**Interfaces (Produces):**

```ts
export const CHAR_WIDTH_RATIO: number; // advance width / font size for Fragment Mono, pinned below
export function cellWidth(char: string): 1 | 2; // 2 for emoji and East Asian wide characters
export function columns(text: string): number; // sum of cellWidth over code points; tabs count as 2

export type SnapshotThemeId =
  "latent-dark" | "latent-light" | "cyanotype" | "paper" | "terminal";
export interface SnapshotTheme {
  id: SnapshotThemeId;
  label: string;
  background: string;
  card: string;
  cardBorder: string;
  text: string;
  muted: string;
  highlight: string;
  accent: string;
  shiki: {
    name: string;
    type: "dark" | "light";
    colors: Record<string, string>;
    tokenColors: {
      scope: string | string[];
      settings: { foreground?: string; fontStyle?: string };
    }[];
  };
}
export const SNAPSHOT_THEMES: readonly SnapshotTheme[]; // in the addendum's order
export function getSnapshotTheme(id: SnapshotThemeId): SnapshotTheme;
```

- [ ] **Step 1:** Measure Fragment Mono's advance ratio once. Load the woff2 in Playwright (or read the `hmtx` advance and `unitsPerEm` with a short script in the scratchpad), and pin the measured value as `CHAR_WIDTH_RATIO`. Record how it was measured in a comment.
- [ ] **Step 2: Write the failing tests:**
  - `columns("abc")` is 3, `columns("a\tb")` is 4, `columns("日本")` is 4, and `columns("👍x")` is 3.
  - `SNAPSHOT_THEMES.map(t => t.id)` is in the addendum order, and `getSnapshotTheme("paper").label` is `"Paper"`.
  - **Contrast:** for every theme, every `tokenColors[].settings.foreground` and `shiki.colors["editor.foreground"]` has a contrast of at least 4.5 against `card`, and `muted` has at least 4.5 against `card`. Use the WCAG formula in a test helper, and name the theme and color in the assertion message.
  - Latent Dark's `card` and `accent` equal the Phase 1 dark tokens `#1b1b28` and `#c08be6`.
- [ ] **Step 3:** Run them. Expected: FAIL. **Step 4:** Implement. **Step 5:** Run them. Expected: PASS.
- [ ] **Step 6:** Commit `feat(snapshot): add fonts, text metrics and themes`.

### Task 2: Options and reducer

**Files:** `domain/options.ts` with its test

**Interfaces (Produces):**

```ts
export type BackgroundStyle = "solid" | "ridges" | "none";
export type FrameStyle = "window" | "minimal";
export type SizePreset = "auto" | "linkedin" | "square";
export type PaddingPreset = "compact" | "comfortable" | "spacious";
export interface SnapshotOptions {
  theme: SnapshotThemeId;
  background: BackgroundStyle;
  frame: FrameStyle;
  title: string;
  lineNumbers: boolean;
  highlighted: readonly number[];
  caption: string;
  size: SizePreset;
  padding: PaddingPreset;
}
export const DEFAULT_OPTIONS: SnapshotOptions; // latent-dark, ridges, window, "", true, [], "", auto, comfortable
export type OptionsAction =
  | { type: "set"; patch: Partial<Omit<SnapshotOptions, "highlighted">> }
  | { type: "toggle-line"; line: number }
  | { type: "clear-highlights" };
export function optionsReducer(
  state: SnapshotOptions,
  action: OptionsAction,
): SnapshotOptions;
```

- [ ] **Step 1: Write the failing tests:**
  - The defaults match the addendum.
  - `set` merges the patch.
  - `toggle-line` adds a line, keeps the list sorted with no duplicates, and removes the line on a second toggle.
  - `clear-highlights` empties the list.
  - Titles longer than 60 characters and captions longer than 120 are trimmed to those lengths.
- [ ] **Step 2–5:** RED, implement, GREEN, commit `feat(snapshot): model snapshot options`.

### Task 3: Layout

**Files:** `domain/layout.ts` with its test

**Interfaces:**

- Consumes: `ColoredLine = { text: string; color: string; fontStyle?: "italic" | "bold" }[]`, defined in `domain/layout.ts` and imported by `highlight/`, plus `SnapshotOptions`, `SnapshotTheme` and `columns`.
- Produces:

```ts
export interface PlacedToken {
  x: number;
  text: string;
  color: string;
  fontStyle?: "italic" | "bold";
}
export interface PlacedLine {
  number: number;
  y: number;
  tokens: PlacedToken[];
  dimmed: boolean;
  highlighted: boolean;
}
export interface SnapshotModel {
  width: number;
  height: number; // whole image
  card: { x: number; y: number; width: number; height: number; scale: number };
  bar: { height: number; title: string } | null; // window frame only
  gutter: { width: number } | null; // line numbers only
  lines: PlacedLine[];
  caption: { text: string; y: number } | null;
  truncated: { lines: boolean; columns: boolean };
  fontSize: number;
  lineHeight: number;
  charWidth: number;
}
export function layoutSnapshot(
  lines: ColoredLine[],
  options: SnapshotOptions,
  languageLabel: string,
): SnapshotModel;
```

- [ ] **Step 1: Write the failing tests** (theme-independent, with `charWidth = 16 * CHAR_WIDTH_RATIO`):
  - **Auto size, comfortable padding, window frame, line numbers on, 3 lines whose longest is 20 columns:**
    - card width = `28*2 + gutterWidth + 20*charWidth`, where `gutterWidth = digits(lastLineNumber)*charWidth + 20`
    - card height = `44 + 28*2 + 3*25.6`
    - image width and height are the card's plus `2*56`
    - card x and y are 56, and scale is 1
  - Line `y` values step by 25.6, and token `x` values accumulate `columns(text)*charWidth`.
  - **Minimal frame:** `bar` is null and the height loses 44. **Line numbers off:** `gutter` is null.
  - The empty title falls back to the language label in `bar.title`.
  - **Highlights:** with `highlighted = [2]`, line 2 is `highlighted` and lines 1 and 3 are `dimmed`. With no highlights, nothing is dimmed.
  - **LinkedIn size:** the image is exactly 1200×627, the card is centered, and `scale = min(1, available/needed)` on both axes.
  - **Caps:**
    - 200 lines are cut to 80 with `truncated.lines` true
    - a 300-column line is cut to 120 columns, ending in `…`, with `truncated.columns` true
    - 5,000 lines × 200 columns are laid out in under 100 ms
  - **Caption:** non-empty text gets a `caption.y` below the card, and the image height grows by 40.
  - **Tabs** expand to 2 spaces before measuring.
- [ ] **Step 2–5:** RED, implement, GREEN, commit `feat(snapshot): lay out snapshots`.

### Task 4: SVG renderer

**Files:** `domain/render-svg.ts` with its test

**Interfaces (Produces):** `renderSvg(model: SnapshotModel, theme: SnapshotTheme, options: { background: BackgroundStyle; fonts?: { mono: string; sans: string } }): string`. The `fonts` values are data URLs. Without them, the SVG names the font families only (for the live preview, where the page already loads them).

- [ ] **Step 1: Write the failing tests** (parse the output with `DOMParser` as `image/svg+xml`, and assert that it has no `parsererror`):
  - The root has `width` and `height` equal to the model's and a matching `viewBox`.
  - **Every line is one `<text>`** with one `<tspan>` per token and the token's `fill`. Dimmed lines have `opacity="0.45"`. Highlighted lines get a `<rect>` filled with `theme.highlight` behind them.
  - **Injection:** code tokens with `<script>alert(1)</script>`, `&amp;`, `]]>` and `"` round-trip as text content. The document has no `script` elements and exactly one root `svg`.
  - **Background:** `solid` draws a full-size rect in `theme.background`, `ridges` also draws the ridge pattern (paths from `buildRidges()`, with low opacity, behind the card), and `none` draws no background rect.
  - **Window frame:** three dots and the title text. **Caption:** a text element with the caption.
  - **Fonts:** with fonts given, a `<style>` with two `@font-face` rules using those data URLs.
- [ ] **Step 2–5:** RED, implement (string building with one `escapeXml` helper used for every text and attribute), GREEN, commit `feat(snapshot): render snapshots to svg`.

### Task 5: Highlighting with Shiki

**Files:** `highlight/highlight.ts` with its test (`// @vitest-environment node`)

**Interfaces (Produces):** `highlight(code: string, language: Language, theme: SnapshotTheme): Promise<ColoredLine[]>`. The highlighter is created lazily once with `createHighlighterCore({ engine: createJavaScriptRegexEngine(), langs: [dynamic imports of the 11 languages], themes: [] })`. Themes load on demand with `loadTheme(theme.shiki)`. `generic` maps to plain text, with every token in the theme foreground.

- [ ] **Step 1:** Install `shiki`.
- [ ] **Step 2: Write the failing tests:**
  - For `const a = "x";` in JavaScript with Latent Dark, the keyword, the string and the identifier get different colors, and joining every token's text per line reproduces each source line exactly.
  - Multi-line input gives one `ColoredLine` per source line, including empty lines (as `[]`).
  - Every language in `LANGUAGES` highlights `x` without throwing.
  - `generic` returns the editor foreground for all tokens.
  - Two calls reuse one highlighter (spy on `createHighlighterCore`, called once).
- [ ] **Step 3–5:** RED, implement, GREEN, commit `feat(snapshot): highlight code with shiki`.

### Task 6: Export helpers

**Files:** `export/fonts.ts`, `export/png.ts` and `export/files.ts` with their tests

**Interfaces (Produces):**

- `loadEmbeddedFonts(fetcher?: typeof fetch): Promise<{ mono: string; sans: string }>` fetches `/fonts/FragmentMono-Regular.woff2` and `/fonts/SchibstedGrotesk-Bold.woff2` as base64 data URLs, memoized.
- `svgToPngBlob(svg: string, width: number, height: number, scale?: number): Promise<Blob>` (browser only; covered by e2e)
- `downloadBlob(blob: Blob, filename: string): void`
- `copyPngToClipboard(blob: Blob): Promise<"copied" | "unsupported">`
- `snapshotFilename(title: string, language: Language, ext: "png" | "svg"): string` (slugged title, else `codeprint-<language>`)

- [ ] **Step 1: Write the failing tests:**
  - `loadEmbeddedFonts` with MSW-served bytes returns `data:font/woff2;base64,…` for both fonts and fetches each once across two calls.
  - `copyPngToClipboard` returns `"unsupported"` when `navigator.clipboard?.write` or `ClipboardItem` is missing, or when `write` rejects. It returns `"copied"` when `write` resolves (stub `navigator.clipboard` and `ClipboardItem`).
  - `snapshotFilename("My Debounce!", "javascript", "png")` is `"my-debounce.png"`, and `snapshotFilename("", "go", "svg")` is `"codeprint-go.svg"`.
  - `downloadBlob` creates an `a[download]` with an object URL, clicks it and revokes the URL (spy on `URL.createObjectURL`/`revokeObjectURL`).
- [ ] **Step 2–5:** RED, implement, GREEN, commit `feat(snapshot): export png, svg and clipboard`.

### Task 7: Snapshot UI

**Files:** `ui/use-snapshot.ts`, `ui/options-panel.tsx`, `ui/snapshot-preview.tsx` and `ui/snapshot-view.tsx` with their tests. Modify `src/app/(tools)/snapshot/page.tsx`, `src/shared/lib/tools.ts` and its test (Snapshot becomes `available`).

**Interfaces:**

- Consumes: everything above, plus Trace's `CodeEditor` and `LanguageSelect` (import from `@/features/trace/ui/*`; acceptable shared UI reuse).
- Produces: `useSnapshot(code, language, options): { svg: string | null; model: SnapshotModel | null; pending: boolean }`. It debounces highlighting by 120 ms and returns `null` for empty or whitespace-only code.

- [ ] **Step 1: Write the failing tests** (mock `highlight` to return deterministic colored lines):
  - Every option in addendum §3 has a labelled control. Theme, background, frame, size and padding are radio groups named "Theme", "Background", "Frame", "Size" and "Padding". The checkbox is "Line numbers". The text inputs are "Title" and "Caption".
  - Changing an option updates the preview (`role="img"` named "Snapshot preview"; its inner SVG reflects, for example, the Paper theme's background color).
  - Empty code shows "Paste code to see it here.", and the three export buttons ("Download PNG", "Download SVG", "Copy image") are disabled. "Try an example" fills in `EXAMPLE_SNIPPET` and enables them.
  - Clicking gutter line number 2 in the preview toggles its highlight (`aria-pressed`). "Clear highlights" appears only when some lines are highlighted.
  - Truncation shows "Showing the first 80 lines" or "Long lines are cut at 120 characters".
  - Copy: a mocked `"copied"` result announces "Copied" in a `role="status"` region. `"unsupported"` shows "Copy isn't available in this browser. Download the PNG instead."
  - Registry: Snapshot `status` is `"available"` (update the tools test).
- [ ] **Step 2–5:** RED, implement per visual-direction and addendum §5, GREEN, commit `feat(snapshot): build the snapshot editor`.

### Task 8: End-to-end, docs and wrap-up

**Files:** Create `tests/e2e/snapshot.spec.ts` and `docs/assets/snapshot-example.png` (an exported image from the app itself). Modify `README.md` (Tools table, Snapshot section) and `docs/adr/0003-snapshot-svg-renderer.md` (create).

- [ ] **Step 1: Write the e2e tests:**
  - "Try an example", then "Download PNG": the download's suggested filename ends in `.png`, and the file starts with the PNG signature bytes, with an IHDR width of 2× the SVG width.
  - "Download SVG": the file parses as SVG, contains `@font-face`, and contains the text `debounce`.
  - **LinkedIn size:** the downloaded PNG is 2400×1254.
  - **Keyboard only:** tab to the Theme radio group, arrow to "Paper", and the preview's background updates.
  - **360px:** no horizontal scroll, and the preview is visible above the editor.
  - **Reduced motion:** no running animations.
- [ ] **Step 2:** Run `pnpm test:e2e`. Expected: PASS.
- [ ] **Step 3:** Docs. The README Snapshot section gets an exported example image, the options list and the "runs fully in your browser" note. ADR 0003 records the own-SVG-renderer decision, font embedding and the measured character ratio.
- [ ] **Step 4:** Run `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm build`. Expected: all pass.
- [ ] **Step 5:** Commit `docs: document snapshot`, push, open the PR `Phase 3: Snapshot`, run the final whole-branch review, fix Critical and Important findings test-first, and ask the owner before merging.
