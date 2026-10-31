# Trace (Phase 2) — Design addendum

- **Date:** 2026-10-31
- **Extends:** [Codeprint design](2026-10-31-codeprint-design.md) §7. Where this addendum is more specific, it wins.
- **Status:** Draft, awaiting approval

## 1. Provider spike results (2026-10-31)

| Source                                                     | Result                                                                                                                                                                 | Decision                                                                                              |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Sourcegraph `/.api/search/stream`                          | Works **anonymously**. Supports `patterntype:regexp`, including multi-line `\n`. Returns repository, path, commit, `repoStars` and line matches as server-sent events. | **Primary provider.** Runs exact, structural and anchor queries.                                      |
| GitHub code search API                                     | `401 Requires authentication`. Literal search only, no regex.                                                                                                          | **Optional second provider**, enabled only when `GITHUB_TOKEN` is set. Runs exact and anchor queries. |
| grep.app API                                               | `429`, blocked by a Vercel bot checkpoint for server calls.                                                                                                            | **Not used.**                                                                                         |
| `raw.githubusercontent.com/{owner}/{repo}/{commit}/{path}` | Works anonymously.                                                                                                                                                     | **Fetches candidate file content** for scoring. Hits outside github.com are dropped.                  |

Consequence: **Trace works without any token.** The GitHub token only widens coverage. The design's §14 "needs a token" item becomes optional.

## 2. Matching engine (pure domain, `src/features/trace/domain/`)

- **Languages:** `javascript`, `typescript`, `python`, `java`, `c`, `cpp`, `csharp`, `go`, `rust`, `php`, `ruby`, plus `generic` (a C-like fallback). Language is auto-detected and the user can override it.
- **Tokenize:** skip whitespace and comments (`//`, `/* */`, and `#` for Python, Ruby and PHP). Emit keywords, identifiers, strings, numbers, operators and punctuation, each with its line number.
- **Normalize:** identifiers become `ID`, strings `STR`, numbers `NUM`. Keywords, operators and punctuation keep their text.
- **Winnow:** k-grams of **k = 5** normalized tokens, hashed with 32-bit FNV-1a, window **w = 4**, robust winnowing (rightmost minimum on ties, no repeated positions).
- **Minimum input:** 20 normalized tokens. Below that, Trace refuses with a "too short" message, because short code matches everywhere.
- **Similarity:** the share of the snippet's distinct fingerprint hashes found in the candidate, from 0 to 1. Results under **0.25** are dropped.
- **Regions and renames:** matched k-grams map snippet tokens to candidate tokens, merged into line ranges. Identifier pairs that differ inside matched regions become rename suggestions (`total → sum`), keeping each source name's most frequent target.
- **Queries:**
  - _exact_: the longest distinctive line (at least 20 characters), literal.
  - _structural_: a multi-line regex over up to 3 consecutive lines, where identifiers become `\w+`, strings become a quoted wildcard, and whitespace becomes `\s*`.
  - _anchors_: up to 2 rare string literals (6 or more characters) and member names (5 or more characters, after `.`), literal.
- **Ranking:** similarity first, then stars. Vendored or bundled paths (`node_modules/`, `vendor/`, `dist/`, `.min.`) rank below originals of equal similarity. Hits whose candidate content is identical collapse into one result with a `copies` count.

## 3. Server

- `POST /api/trace` with body `{ code: string (1..20000 chars), language?: Language }`, validated by Zod.
- It answers with **NDJSON** (`application/x-ndjson`) so results stream in as they are scored. Events: `started`, `result`, `provider`, `done`, `error`.
- Safeguards:
  - per-IP rate limit of **10 requests per minute** (in memory)
  - **8s** timeout per provider request
  - at most **20** candidate files fetched, **5** at a time, up to **512 KB** each
  - an in-memory cache of finished traces, keyed by language plus the snippet's fingerprint: 50 entries for 10 minutes
- If one provider fails, the trace still finishes with what the others found. The `provider` event tells the UI which source was down.
- **E2E mocking:** `src/instrumentation.ts` starts an MSW node server with fixture handlers only when `CODEPRINT_E2E_MOCKS=1`. Playwright sets it, and production never does.

## 4. UI (`/trace`)

- **Input:** a code editor (a textarea with a line-number gutter, monospace, no heavy editor dependency), a language select showing the detected language, a **Trace** button, a `Ctrl`/`⌘` + `Enter` hint, and **Try an example**, which fills in a known snippet.
- **While tracing:** the snippet's fingerprint forms with a scan sweep (pure CSS, so it stays static under reduced motion). An `aria-live` status says what is happening.
- **Results:** cards arrive as they are scored and are re-ranked live. Each shows the repo, file path linked to the exact lines on GitHub, stars, a similarity meter with the percentage, and a vendored or copies note when relevant.
- **Compare:** each card expands inline into a side-by-side view of the snippet and the candidate excerpt, with matched lines highlighted and rename chips.
- **States:**
  - **Too short:** "This snippet is too short to trace. Paste a few lines, at least 20 tokens."
  - **No matches:** "No public matches found. The code may be original, private, or changed beyond recognition."
  - **Partial:** "Sourcegraph didn't respond, so these results may be incomplete."
  - **Rate limited:** "Too many traces in a minute. Try again shortly."
- The tool registry marks Trace `available`, so the landing card says "Available" and the nav links to the real page.

## 5. Calls I made (owner can veto)

- **The landing hero stays as it is.** Its "Trace a snippet" button opens `/trace`, where **Try an example** gives the instant demo. The spec's "live demo above the fold" becomes a one-click demo, because a second bold element would compete with the print. Cost if wrong: add a compact input to the hero later.
- **NDJSON over a plain JSON response**, so the spec's "results stream in" is real.
- **The thresholds and parameters above** are starting values. They are pinned by fixture tests and documented in the README.
