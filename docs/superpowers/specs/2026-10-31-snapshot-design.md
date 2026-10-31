# Snapshot (Phase 3) — Design addendum

- **Date:** 2026-10-31
- **Extends:** [Codeprint design](2026-10-31-codeprint-design.md) §8. Where this addendum is more specific, it wins.
- **Status:** Draft, awaiting approval

## 1. What it is

Paste a snippet and get a polished image of it, ready for a LinkedIn post, a README or a slide. Everything runs in the browser: no server and no network calls after the page loads.

It is the tool most likely to be _used_ in the LinkedIn post itself, so the output must look unmistakably like Codeprint without shouting.

## 2. The image is an SVG we build ourselves

Codeprint does not screenshot the DOM (html-to-image and friends). It renders the image as an **SVG string from a pure function**:

```
code + language ──Shiki──▶ colored tokens ──layout (pure)──▶ SnapshotModel ──render (pure)──▶ SVG string
                                                                                       └──▶ canvas ──▶ PNG
```

- **Why:** the layout and rendering are deterministic and fully unit-testable (positions, escaping, sizes). The SVG export is crisp at any size. The PNG is the same SVG drawn onto a canvas at 2× scale.
- **Fonts:** the SVG embeds Fragment Mono (code) and Schibsted Grotesk (title) as base64 `@font-face`, subset to Latin. A canvas only draws fonts that live inside the SVG. Both fonts are OFL-licensed and ship as files in `public/fonts/`, alongside their licenses.
- **Monospace layout:** character width is a constant ratio of the font size (measured once for Fragment Mono and pinned in a test), so layout needs no DOM measurement. Tabs expand to 2 spaces.

## 3. Options (all on one screen, live preview)

| Option          | Values                                                                                                              | Default                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Theme           | Latent Dark, Latent Light, Cyanotype (blueprint blue), Paper (warm print-like light), Terminal (high-contrast dark) | Latent Dark                          |
| Background      | Solid, Ridges (the fingerprint motif, subtle), None (transparent, PNG/SVG only)                                     | Ridges                               |
| Frame           | Window (title bar with a filename), Minimal (no chrome)                                                             | Window                               |
| Title           | Free text in the window bar, e.g. `debounce.js`                                                                     | Empty, so the bar shows the language |
| Line numbers    | On / Off                                                                                                            | On                                   |
| Highlight lines | Click gutter numbers to toggle. Non-highlighted lines dim to 45% opacity.                                           | None                                 |
| Caption         | One short line under the code, e.g. "Found in 19 public repos with Codeprint"                                       | Empty                                |
| Size            | Auto (fits the code), LinkedIn (1200×627), Square (1080×1080). Fixed sizes scale the card to fit and center it.     | Auto                                 |
| Padding         | Compact, Comfortable, Spacious                                                                                      | Comfortable                          |

**Exports:** Download PNG (2×), Download SVG, Copy PNG to clipboard (when the browser allows it, with a fallback message otherwise).

**Limits:** up to 80 lines and 120 columns. Longer content is cut, and the UI says so ("Showing the first 80 lines"), because an image with 300 lines is unreadable on a feed.

## 4. Themes

Each theme is a small object: `background`, `card`, `cardBorder`, `text`, `muted`, `highlight` (the highlighted-line wash), `accent` (window dots, caption mark), plus a Shiki theme for the token colors.

- **Latent Dark / Light:** use the Phase 1 tokens. Token colors come from a custom Shiki theme built around the ninhydrin purple.
- **Cyanotype:** echoes Blueprint (Phase 5): blue paper and white ink.
- **Paper:** a warm, editorial light theme for people who post in light mode.
- **Terminal:** for maximum contrast.

Each theme's code colors must reach 4.5:1 against its card. A test checks every token color in every theme.

## 5. UI (`/snapshot`)

- **Desktop:** two columns. On the left, the editor (reusing Trace's `CodeEditor` and `LanguageSelect`) and the options. On the right, a sticky live preview with the export buttons. Mobile stacks them: preview first, then the editor and options.
- **Options:** native controls (segmented radio groups, select, checkbox, text inputs), all labelled and keyboard reachable.
- **Starting state:** **Try an example** fills in a snippet. Before that, the preview shows a placeholder card with the copy "Paste code to see it here."
- **Clipboard feedback:** "Copied" goes to a live region.
- The tool registry flips Snapshot to `available`.

## 6. Not in scope

- Sharing links or saving snapshots (there is no backend).
- Animated output (GIF or video).
- Fonts other than the two bundled ones.
- "Send to Trace" or "Snapshot this result" cross-links. They are nice, but they cost URL or state plumbing. They become a later follow-up.

## 7. Calls I made (owner can veto)

- **Own SVG renderer instead of a DOM-to-image library.** It is testable, crisp and has no fragile dependency. The cost is more code for layout.
- **The five themes above.** Latent Dark is the default, so posts are recognisably Codeprint.
- **The 80-line and 120-column cap.**
- **No cross-links with Trace yet.**
