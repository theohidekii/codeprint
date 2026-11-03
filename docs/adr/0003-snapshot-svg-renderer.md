# ADR 0003: Snapshot renders its own SVG

- **Status:** Accepted
- **Date:** 2026-11-03

## Context

Snapshot turns code into an image for posts and slides. The common approach screenshots DOM nodes with a library such as html-to-image. That works, but the result depends on the browser's layout and fonts, and it is hard to test without a real browser.

## Decision

- **Pipeline:** Shiki tokens → `layoutSnapshot` (pure) → `renderSvg` (pure) → an SVG string. The PNG is that SVG drawn onto a canvas at 2× scale. The preview is an `<img>` of the same SVG, so what you see is exactly what you export, and the SVG's styles never touch the page.
- **Monospace grid:** every glyph advances `16px × 0.618`. The ratio is Fragment Mono's measured advance: 618 units per em, checked in Chromium with canvas `measureText`. Wide characters (CJK, emoji) take two cells. Tabs become two spaces.
- **Fonts:** Fragment Mono and Schibsted Grotesk Bold (both OFL) ship in `public/fonts/` and are embedded in the SVG as base64 `@font-face`. A canvas only draws fonts that live inside the SVG.
- **Code text** gets its font, size and `font-variant-ligatures: none` as attributes on each element. A global `text {}` rule would override the title's and caption's font attributes, and ligatures would turn `=>` into `⇒`.
- **Highlighting** uses Shiki's core with precompiled grammars and the raw JavaScript engine: no WebAssembly, and no regex conversion at runtime.
  - With the on-the-fly regex engine, the first highlight of a heavy grammar (C++) took more than 5 s, and Shiki's default 500 ms per-line limit silently left lines uncolored.
  - The tokenize limit is now 5 s.
  - Input is capped to what the image can show: 81 lines × 480 characters.
- **Safety:** every text and attribute goes through one `escapeXml`, which also drops characters XML cannot contain. Tests feed `<script>`, `]]>` and `</svg>` through it.

## Consequences

- Layout and rendering are covered by fast unit tests (positions, sizes, escaping, themes, contrast). Only the canvas-to-PNG step needs end-to-end tests, which check real downloads (the PNG signature and IHDR dimensions).
- The renderer owns more code than a screenshot library would, including the window frame, the highlight washes and the ridge background.
- Proportional fonts and ligatures are out of scope by design.
- The precompiled grammars make the client bundle somewhat larger. They load on first use of Snapshot, not on other pages.
