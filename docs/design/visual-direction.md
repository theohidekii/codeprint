# Visual direction: A, "Latent"

Chosen by the owner on 2026-10-31 from three mockups in [`direction-mockups/`](direction-mockups/). The reference is [`a.html`](direction-mockups/a.html).

## Idea

A latent fingerprint developed with ninhydrin, the forensic reagent that turns invisible prints purple. Code is the evidence: the signature visual is a loop-pattern fingerprint whose ridges are written in lines of code, which "develops" from the core outward on first load.

**Spend boldness in one place.** The fingerprint is the memorable thing. Everything else stays quiet: cool lab-gray surfaces, one purple accent, generous space and heavy grotesque headlines.

## Color tokens

All text pairs pass WCAG AA (verified with the WCAG relative-luminance formula).

| Token             | Light     | Dark      | Use                                                        |
| ----------------- | --------- | --------- | ---------------------------------------------------------- |
| `background`      | `#eef1f4` | `#12121c` | Page                                                       |
| `surface`         | `#ffffff` | `#1b1b28` | Cards, panels                                              |
| `surface-raised`  | `#f7f8fa` | `#23233a` | Hover, popovers, code wells inside surfaces                |
| `border`          | `#cdd3dc` | `#2e2d40` | Hairlines, outlines                                        |
| `text`            | `#161a2e` | `#eceaf4` | Body and headings                                          |
| `text-muted`      | `#535a70` | `#a4a2b8` | Secondary copy                                             |
| `accent`          | `#6a2c91` | `#c08be6` | Ninhydrin purple: primary actions, developed ridges, focus |
| `accent-contrast` | `#ffffff` | `#1b1b28` | Text on `accent`                                           |
| `accent-soft`     | `#ece2f3` | `#2a2140` | Badges, highlighted tokens                                 |
| `ridge-idle`      | `#c4cad4` | `#2c2b3c` | Undeveloped ridges (decorative, no contrast requirement)   |
| `danger`          | `#b42318` | `#ff8a80` | Errors                                                     |
| `success`         | `#1f7a4d` | `#6fd6a0` | Confirmations                                              |

## Typography

- **Display and UI:** Schibsted Grotesk (400, 500, 700, 900). Headlines use 900 with tight tracking.
- **Code:** Fragment Mono (400). Used only for code, never for labels.
- **Scale** (a 1.25 ratio from a 16px base, with a fluid hero):

| Step  | Size                       | Weight | Line height | Tracking |
| ----- | -------------------------- | ------ | ----------- | -------- |
| Hero  | `clamp(48px, 7.2vw, 96px)` | 900    | 0.95        | -0.045em |
| H2    | 34px                       | 900    | 1.1         | -0.03em  |
| H3    | 22px                       | 700    | 1.25        | -0.015em |
| Lead  | 19px                       | 400    | 1.5         | 0        |
| Body  | 16px                       | 400    | 1.5         | 0        |
| Small | 13px                       | 500    | 1.4         | 0        |
| Code  | 14px                       | 400    | 1.75        | 0        |

- Line length stays under about 30em for lead copy.
- Sentence case everywhere. No all-caps labels, no eyebrow labels above headings, and no single-word color accents in headlines.

## Shape and space

- Radius: `sm` 4px (focus rings, marks), `md` 10px (buttons, inputs), `lg` 18px (cards), `full` (badges).
- Spacing: a 4px base. Section rhythm is 88–96px on desktop and 56px on mobile.
- Max content width 1180px, with 24px gutters (16px under 400px).
- No drop shadows. Depth comes from `surface` against `background` and 1px `border`s.

## Motion

- **One orchestrated moment:** the hero print develops over 2200ms with ease-out-cubic, after a 300ms delay.
- Responsive motion: the theme icon swap and menu open/close take 160ms with `cubic-bezier(0.2, 0, 0, 1)`.
- No scroll-triggered entrances on cards or sections.
- `prefers-reduced-motion: reduce` renders every final state immediately.

## Focus

A 2px `accent` outline with a 3px offset and `sm` radius on every interactive element (`:focus-visible`).
