# Codeprint — Design

- **Date:** 2026-10-31
- **Status:** Approved 2026-10-31
- **Owner:** Theo Hideki

## 1. Intent

Codeprint is a portfolio project, built to be shown in a portfolio and announced in a LinkedIn post. There are no paying users and no deadline. It succeeds if someone watching the demo (README GIF, LinkedIn video) gets it in five seconds and remembers it, if it runs locally with one command, and if a developer who opens the repository sees clean, tested, well-documented code.

The theme that ties it together is **the fingerprint of code**. The name and the visual identity come from that: a forensic, investigative look where code is evidence and Codeprint is the lab.

## 2. What it is

One web app with four tools. They share a design system, layout and code conventions:

| #   | Tool                              | One line                                                                                                                                                  |
| --- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Trace** (source finder)         | Paste a snippet and Codeprint finds public repositories containing the same code, even when identifiers were renamed, ranked by similarity. **Flagship.** |
| 2   | **Snapshot** (code as visual)     | Paste a snippet and get a polished, shareable image: themes, frames, annotations, export to PNG/SVG.                                                      |
| 3   | **Fingerprint** (generative art)  | Enter a GitHub user or repo and get a unique generative poster from its languages, commit rhythm, active hours and file sizes. Downloadable.              |
| 4   | **Blueprint** (architecture plan) | Enter a GitHub repo and get its module and dependency structure drawn as a technical blueprint (blue paper, drafting lines, hotspots).                    |

The tool names are the builder's call and can change.

## 3. Goals, non-goals, anti-goals

**Goals**

- An extremely well-crafted UI with a distinctive identity, micro-interactions, motion, and polished empty, loading and error states. Responsive and accessible (WCAG AA).
- Built with strict TDD: every behavior starts as a failing test.
- Clean, organized, professional code with pure domain logic separated from UI and I/O.
- All code, comments, docs and commits in **English**.
- A public GitHub repository with a strong README (demo GIF, architecture, how the matching works) and CI.
- Runs locally with `pnpm install && pnpm dev`. **Not deployed** (owner's decision). The post links to the repository and shows a recorded demo.

**Non-goals**

- User accounts, persistence, history, payments.
- Searching private code.
- A legal-grade plagiarism verdict. Trace says _where similar code exists_, not _who is guilty_.
- Running a code index of our own. Trace relies on public search providers.

**Anti-goals (failure even if it "works")**

- Looks like a default shadcn/template dashboard.
- Tests written after the code, or coverage-padding tests that assert nothing.
- Leaking API tokens to the browser.
- Results that look confident while being noise. Trace must show _why_ something matched.

## 4. Build order

Each phase ships complete (tests, UI, docs) before the next starts:

1. **Foundation.** Repo, tooling, CI, design system, app shell, landing page.
2. **Trace.** Flagship.
3. **Snapshot.**
4. **Fingerprint.**
5. **Blueprint.**

Each phase after Foundation gets its own short design pass and plan when it starts. This document details Foundation and Trace and sketches the rest.

## 5. Tech stack (builder's call, approved in principle by owner)

| Concern                  | Choice                                                               |
| ------------------------ | -------------------------------------------------------------------- |
| Framework                | Next.js (App Router), React, TypeScript `strict`                     |
| Package manager          | pnpm (enable with `corepack enable`)                                 |
| Styling                  | Tailwind CSS, shadcn/ui primitives (restyled heavily), Framer Motion |
| Validation               | Zod at every boundary (API input, provider responses, env)           |
| Unit and component tests | Vitest + Testing Library                                             |
| HTTP mocking             | MSW. Tests never hit the network.                                    |
| E2E                      | Playwright                                                           |
| Lint and format          | ESLint + Prettier, enforced in CI                                    |
| CI                       | GitHub Actions: lint, typecheck, unit, e2e, build                    |
| Commits                  | Conventional Commits                                                 |

## 6. Architecture

```
src/
  app/                    # Next.js routes (thin: compose features, no logic)
    (tools)/trace/ ...
    api/trace/route.ts    # server-only: calls providers with secrets
  features/
    trace/
      domain/             # pure TS, no I/O, heavily unit-tested
        tokenize.ts
        normalize.ts
        winnow.ts
        similarity.ts
        query-builder.ts
        rank.ts
      providers/          # adapters to external search APIs (port + impls)
      ui/                 # React components for this feature
    snapshot/ fingerprint/ blueprint/   # same shape, later phases
  shared/
    ui/                   # design system components
    lib/                  # small generic helpers
  env.ts                  # Zod-validated environment
tests/e2e/                # Playwright
```

Rules:

- `domain/` never imports from `ui/`, `providers/`, `app/` or Next.js.
- Providers implement one interface, so they can be swapped and mocked.
- Route handlers stay thin: validate input, call a use case, map to a response.

## 7. Trace: how it works

### 7.1 User flow

1. User pastes a snippet (language auto-detected, overridable).
2. Codeprint shows the snippet's "fingerprint" forming (animated) while searching.
3. Results stream in as cards: repo, file path, link to the exact lines, stars, and a **similarity score**.
4. Opening a result shows a side-by-side diff with the matching regions highlighted, and identifiers that were renamed marked as such (e.g. `total → sum`).
5. Clear states for: snippet too short to be meaningful, no matches, provider rate-limited or down (partial results still shown).

### 7.2 Matching pipeline (pure domain logic)

1. **Tokenize** the snippet with a lightweight lexer that knows comments, strings, numbers, identifiers, keywords and operators for popular languages (JS/TS, Python, Java, C/C++, C#, Go, Rust, PHP, Ruby). Unknown languages fall back to a generic C-like lexer.
2. **Normalize**: drop comments and whitespace, then replace every non-keyword identifier with a placeholder (`ID`), and literals with `STR` and `NUM`. Two snippets that differ only by renaming become identical token streams.
3. **Fingerprint** with _winnowing_ (Schleimer, Wilkerson, Aiken 2003, the algorithm behind Stanford's MOSS): hash k-grams of normalized tokens and keep the minimum hash in each sliding window.
4. **Build search queries.** Search engines match text, not normalized tokens, so renamed code needs smarter queries:
   - _exact_ query: a distinctive line or run taken verbatim.
   - _structural_ query: a regex where identifiers become `\w+` and literals stay or are loosened, run against providers that support regex.
   - _anchor_ queries: rare literal strings, API calls and member names that usually survive renaming.
5. **Fetch candidates** from providers, then download each candidate file's content.
6. **Score**: fingerprint the candidate file with the same pipeline. Similarity is the share of the snippet's fingerprints found in the candidate. Matching regions are mapped back to line ranges.
7. **Rank and dedupe**: by similarity, then signals of originality (oldest commit or creation date, stars, not a fork). Forks and vendored copies (`node_modules`, `vendor/`) are grouped under their likely origin.

The thresholds (k, window size, minimum snippet length, score cut-off) are chosen by the builder, backed by fixture-driven tests, and documented in the README.

### 7.3 Providers

Behind one `SearchProvider` interface:

- **GitHub code search API**: needs a server-side token, which lives in an env var on the server and is never sent to the browser. Rate-limited.
- **Sourcegraph** public search and/or **grep.app**: regex-capable, used for the structural queries.

Which of these are usable today, and on what terms, is **verified at the start of the Trace phase** with a short spike. If one is not usable, the design falls back to the others. At least one regex-capable provider is required for rename-tolerant search. If none exists, Trace degrades to exact plus anchor queries, and that limit is stated in the UI.

Server-side safeguards: per-IP rate limiting on `/api/trace`, a request timeout per provider, and an in-memory cache of recent queries.

## 8. Other tools (sketch, detailed at their phase)

- **Snapshot:** client-side rendering. Syntax highlighting with Shiki. Themes that match the Codeprint identity plus classics. Line highlights and annotations. Export PNG and SVG. Optional "Send to Trace".
- **Fingerprint:** GitHub REST/GraphQL via the server. A deterministic generator (same input means the same art), seeded from the profile data. Rendered to canvas or SVG. Downloadable poster sized for LinkedIn.
- **Blueprint:** fetch the repo tree and parse imports for supported languages into a module graph. Lay it out and render it as a blueprint-styled SVG with zoom and pan. Hotspots are large files and highly connected modules.

## 9. UI direction

- **Identity:** forensic lab meets precision engineering. Dark-first with a light theme. A sharp monospace and a distinctive grotesque for display. A restrained palette with one signature accent. Fingerprint-ridge motifs and fine technical grid lines.
- **Motion:** purposeful only. The fingerprint "scans" while Trace searches, results arrive staggered, transitions between tools are smooth. Respects `prefers-reduced-motion`.
- **Landing page:** explains the four tools in one scroll, with a live Trace demo above the fold.
- **Quality bar:** keyboard-first (paste and run with ⌘/Ctrl+Enter), visible focus states, AA contrast, no layout shift, fast first load.

Exact fonts, palette and components are the builder's call, guided by the frontend-design skill and shown to the owner as mockups before the Foundation phase locks them in.

## 10. Testing strategy

- **Red, green, refactor** for every behavior. A commit history that shows tests landing with or before the code is welcome.
- **Domain:** exhaustive unit tests, including table-driven fixtures of snippet pairs (identical, renamed, reordered, unrelated) with expected score bands.
- **Providers:** contract tests against recorded responses through MSW, including rate-limit and malformed responses.
- **UI components:** behavior-focused Testing Library tests (what the user sees and does), not snapshots of markup.
- **E2E:** Playwright covering the happy path and error path of each tool, with network mocked.
- **Coverage:** reported in CI. Domain code is expected near 100%. No target is set for UI.

## 11. Documentation

- `README.md`: pitch, demo GIF and screenshots, features, how Trace's matching works (with a diagram), architecture, local setup, testing, and the limits of the approach.
- `CONTRIBUTING.md`: conventions, TDD workflow, commit style.
- `docs/`: this design, per-phase designs and plans, ADRs for notable decisions.
- `.env.example`: every variable documented.
- License: MIT.

## 12. Repository

- Public GitHub repo `theohidekii/codeprint`.
- `main` protected by CI. Work happens on branches merged through PRs, so the history reads well for visitors.

## 13. Left to the builder

- Exact tool names, fonts, palette, component designs (shown as mockups first).
- Winnowing parameters, thresholds, and ranking weights (tested and documented).
- Lexer details per language.
- Caching and rate-limit specifics.
- Which providers to use, per the Trace spike.
- **UI copy in English**, matching the docs and reaching a wider LinkedIn audience (builder's call).

## 14. Needs the owner later

- A GitHub personal access token (read-only, public scope) for the server's env, at the Trace phase.
- Reacting to the UI mockups before the design system is locked.
