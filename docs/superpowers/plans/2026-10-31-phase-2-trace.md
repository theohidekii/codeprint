# Phase 2 — Trace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Paste a snippet at `/trace` and get public repositories containing the same code, even with renamed identifiers, ranked by similarity, streamed live, with a side-by-side comparison.

**Architecture:** A pure matching engine in `src/features/trace/domain/` (tokenize → normalize → winnow → compare, plus query building and ranking). Provider adapters in `providers/` (Sourcegraph always, GitHub when a token exists, raw file fetching). A server use case in `server/` streams `TraceEvent`s. A thin `POST /api/trace` route serves NDJSON. The client UI lives in `ui/`.

**Tech Stack:** As in Phase 1, plus no new runtime dependencies. SSE and NDJSON are parsed by hand. Fixtures come from real Sourcegraph responses.

**Spec:** `docs/superpowers/specs/2026-10-31-codeprint-design.md` §7 and `docs/superpowers/specs/2026-10-31-trace-design.md` (the addendum wins where more specific).

## Global Constraints

- Everything from Phase 1's Global Constraints still applies: English, strict TS, TDD, Conventional Commits with the co-author line, branch plus PR, no network in tests, AA contrast, reduced motion, 360px.
- Branch: `phase-2-trace`. PR into `main` when done. Ask the owner before merging.
- Parameters (addendum §2–3): `K = 5`, `WINDOW = 4`, `MIN_TOKENS = 20`, `MIN_SIMILARITY = 0.25`, rate limit `10/min/IP`, provider timeout `8000ms`, `MAX_CANDIDATES = 20`, `FETCH_CONCURRENCY = 5`, `MAX_FILE_BYTES = 524288`, cache `50` entries for `600000ms`, `MAX_CODE_CHARS = 20000`.
- Domain code (`domain/`) imports nothing outside `domain/` except `zod` if needed. The ESLint rule from Phase 1 enforces this.
- UI copy is exactly as written in addendum §4.

## Review Focus

1. **Pathological input:** a 20,000-character single line, binary-looking text, or 5,000 repeated tokens must not hang the server. Tokenize, winnow and compare stay linear-ish. Pinned in Task 5 (a performance test under 200ms for 20k chars).
2. **Unterminated strings and comments:** `"abc` or `/* never closed` must tokenize without throwing or looping. Pinned in Task 1.
3. **Hostile provider data:** a malformed SSE line, an unexpected JSON shape, or a huge file must be skipped, not crash the trace. Pinned in Tasks 8 and 9.
4. **Regex injection:** snippet text containing regex metacharacters must be escaped in structural and exact queries. Pinned in Task 6.
5. **Client disconnect mid-stream:** an aborted request must cancel provider fetches (via `AbortSignal`), not leak work. Pinned in Task 10.

---

## File Structure

```
src/features/trace/
  domain/
    types.ts            Language, Token, NormalizedToken, Fingerprint, SearchQuery, TraceResult…
    constants.ts        K, WINDOW, MIN_TOKENS, MIN_SIMILARITY
    languages.ts        keyword sets and comment syntax per language
    tokenize.ts         tokenize(), detectLanguage()
    normalize.ts
    winnow.ts
    compare.ts          similarity, regions, renames
    queries.ts          buildQueries()
    rank.ts
    examples.ts         EXAMPLE_SNIPPET used by "Try an example" and e2e
    __fixtures__/pairs.ts   snippet pairs with expected score bands
  providers/
    types.ts            SearchProvider, SearchHit, ProviderStatus
    sourcegraph.ts
    github.ts
    content.ts          fetchFileContent()
    __fixtures__/sourcegraph-*.txt   recorded SSE bodies
  server/
    run-trace.ts        runTrace(): AsyncGenerator<TraceEvent>
    rate-limit.ts
    cache.ts
    ndjson.ts
  ui/
    trace-view.tsx      page-level client component
    code-editor.tsx  language-select.tsx  use-trace.ts
    result-card.tsx  similarity-meter.tsx  comparison-view.tsx  scanning-print.tsx
src/app/api/trace/route.ts
src/app/(tools)/trace/page.tsx           (replaces the placeholder)
src/instrumentation.ts                   (e2e mocks only)
src/test/msw/trace-handlers.ts
src/shared/ui/kbd.tsx
tests/e2e/trace.spec.ts
```

Every `*.ts(x)` gets a co-located `*.test.ts(x)` unless the task says otherwise.

---

### Task 1: Domain types and the tokenizer for C-like languages

**Files:** Create `domain/types.ts`, `domain/constants.ts`, `domain/languages.ts`, `domain/tokenize.ts`, `domain/tokenize.test.ts`

**Interfaces (Produces):**

```ts
export type Language =
  | "javascript"
  | "typescript"
  | "python"
  | "java"
  | "c"
  | "cpp"
  | "csharp"
  | "go"
  | "rust"
  | "php"
  | "ruby"
  | "generic";
export const LANGUAGES: readonly Language[]; // in that order
export type TokenKind =
  "keyword" | "identifier" | "string" | "number" | "operator" | "punctuation";
export interface Token {
  kind: TokenKind;
  text: string;
  line: number;
  start: number;
  end: number;
} // line is 1-based, start/end are offsets
export function tokenize(source: string, language: Language): Token[];
```

`languages.ts` exports `LANGUAGE_SPECS: Record<Language, { label: string; keywords: ReadonlySet<string>; lineComments: readonly string[]; blockComments: readonly [string, string][]; stringQuotes: readonly string[] }>`. Labels: "JavaScript", "TypeScript", "Python", "Java", "C", "C++", "C#", "Go", "Rust", "PHP", "Ruby", "Other".

- [ ] **Step 1: Write the failing tests** (`javascript` unless noted):
  - `tokenize("const total = 1;", "javascript")` gives kinds `["keyword","identifier","operator","number","punctuation"]` and texts `["const","total","=","1",";"]`.
  - Comments and whitespace are dropped: `"a // x\n/* y */ b"` gives texts `["a","b"]` with lines `[1,2]`.
  - Strings keep their quotes as one token: `'it\'s'`, `"a\"b"` and a template literal `` `x${y}` `` each give exactly one `string` token.
  - Numbers: `0x1F`, `1_000`, `3.14e-2` and `10n` are each one `number`.
  - Multi-character operators are single tokens: `=== !== => ?? ?. ++ && || >>> **=`.
  - Unterminated input never throws: `'"abc'` gives one `string` token running to the end, and `"/* open"` gives `[]`.
  - Offsets: `tokenize("ab  cd")[1]` has `start: 4, end: 6`.
- [ ] **Step 2:** Run `pnpm test src/features/trace/domain/tokenize`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement a single-pass scanner driven by `LANGUAGE_SPECS` (one index, no regex backtracking over the whole input). Operators are matched longest-first from a fixed list. Identifiers match `[A-Za-z_$][\w$]*` (Unicode letters allowed via `\p{L}`). Identifiers in the keyword set become `keyword`.
- [ ] **Step 4:** Run it. Expected: PASS. Run the full `pnpm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(trace): tokenize c-like languages`.

### Task 2: Other language families and language detection

**Files:** Modify `domain/languages.ts`, `domain/tokenize.ts`. Test `domain/tokenize.test.ts`, `domain/detect-language.test.ts`

**Interfaces (Produces):** `detectLanguage(source: string): Language`, exported from `tokenize.ts`.

- [ ] **Step 1: Write the failing tests:**
  - Python: `"# note\ndef f(x):\n    return x"` drops the comment; `def` and `return` are keywords; `'''doc'''` and `"""doc"""` are each one string.
  - Ruby: `#` comments; `def`/`end` are keywords. PHP: `#`, `//` and `/* */` comments, and `$name` is one identifier.
  - Go: backtick raw strings are one token. Rust: `'a'` is a string-ish token, but a lifetime `'a` in `&'a str` doesn't swallow the rest (it becomes an identifier or operator; it just must not span past the line).
  - `detectLanguage` returns `python` for `def x():\n  pass`, `go` for `package main\nfunc main() {}`, `rust` for `fn main() { let mut x = 1; }`, `typescript` for `const a: number = 1; interface X {}`, `javascript` for `const a = () => 1;`, `java` for `public class A { public static void main(String[] a) {} }`, `php` for `<?php echo $x;`, `ruby` for `def x\n  puts 1\nend`, `csharp` for `using System; namespace A { class B {} }`, `c` for `#include <stdio.h>\nint main(void) { return 0; }`, `cpp` for `#include <vector>\nstd::vector<int> v;`, and `generic` for `hello world`.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Fill in `LANGUAGE_SPECS` for every language. `detectLanguage` scores each language by weighted signature regexes (e.g. `^\s*def .*:\s*$` for Python, `^package \w+` for Go, `<?php`), with the highest score winning and `generic` when every score is 0. Ties go in `LANGUAGES` order.
- [ ] **Step 4:** Run `pnpm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(trace): support more languages and detect language`.

### Task 3: Normalize

**Files:** Create `domain/normalize.ts`, `domain/normalize.test.ts`

**Interfaces:**

- Consumes: `Token` (Task 1).
- Produces: `interface NormalizedToken { value: string; token: Token }` and `normalize(tokens: Token[]): NormalizedToken[]`.

- [ ] **Step 1: Write the failing tests:**
  - Identifiers become `"ID"`, strings `"STR"` and numbers `"NUM"`. Keywords, operators and punctuation keep their text.
  - Renaming invariance: `normalize(tokenize(A))` and `normalize(tokenize(B))` have equal `value` arrays when A = `function sum(values){let acc=0;for(const v of values)acc+=v;return acc}` and B is the same code with names `total, items, s, x`.
  - Each output keeps a reference to its source token (`result[1].token.text === "sum"`).
- [ ] **Step 2:** Run it. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5:** Commit `feat(trace): normalize tokens`.

### Task 4: Winnowing

**Files:** Create `domain/winnow.ts`, `domain/winnow.test.ts`

**Interfaces:**

- Consumes: `NormalizedToken`.
- Produces: `interface Fingerprint { hash: number; position: number }` (position is the k-gram's start index), `fnv1a(text: string): number` (32-bit unsigned), and `winnow(tokens: NormalizedToken[], options?: { k?: number; window?: number }): Fingerprint[]` (defaults `K`, `WINDOW`).

- [ ] **Step 1: Write the failing tests:**
  - `fnv1a("")` is `2166136261` and `fnv1a("a")` is `3826002220`.
  - Fewer than `k` tokens gives `[]`. Exactly `k` tokens gives one fingerprint at position 0.
  - Winnowing guarantee: for a random-but-seeded stream of 200 tokens, every run of `k + window - 1` consecutive tokens contains the start of at least one selected k-gram.
  - Robust ties: when several hashes in a window are equal, the rightmost is chosen, and a position is never emitted twice.
  - Determinism: identical input gives identical output.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement. Hash each k-gram as `fnv1a(values.join("\u0000"))`, then do a sliding-window minimum with rightmost tie-breaking, emitting only when the selected position changes.
- [ ] **Step 4:** Run it. Expected: PASS. **Step 5:** Commit `feat(trace): fingerprint with winnowing`.

### Task 5: Compare: similarity, regions and renames

**Files:** Create `domain/compare.ts`, `domain/compare.test.ts`, `domain/__fixtures__/pairs.ts`

**Interfaces:**

- Consumes: `NormalizedToken`, `winnow`.
- Produces:

```ts
export interface LineRange {
  start: number;
  end: number;
} // 1-based, inclusive
export interface MatchRegion {
  snippet: LineRange;
  candidate: LineRange;
}
export interface Rename {
  from: string;
  to: string;
}
export interface Comparison {
  similarity: number;
  regions: MatchRegion[];
  renames: Rename[];
}
export function compare(
  snippet: NormalizedToken[],
  candidate: NormalizedToken[],
): Comparison;
```

`pairs.ts` exports `PAIRS: { name: string; snippet: string; candidate: string; language: Language; min: number; max: number }[]` with these cases:

- identical (min 1, max 1)
- renamed-only (min 1, max 1)
- snippet embedded in a 120-line file (min 0.95)
- two statements reordered (min 0.5, max 0.95)
- one line changed in ten (min 0.6, max 0.95)
- unrelated code of the same language (max 0.15)

- [ ] **Step 1: Write the failing tests:**
  - `it.each(PAIRS)` asserts `similarity` is within `[min, max]`.
  - Renamed-only gives `renames` containing `{ from: "acc", to: "total" }` and `{ from: "values", to: "items" }`, with no entry where `from === to`.
  - Embedded: the region's `candidate.start` equals the line where the snippet begins inside the file, and `snippet` is `{ start: 1, end: <snippet line count> }`.
  - Empty candidate gives `{ similarity: 0, regions: [], renames: [] }`.
  - Performance: comparing a 20,000-character generated snippet with itself takes under 200ms (`performance.now()`).
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement:
  - similarity = |distinct snippet hashes ∩ candidate hashes| / |distinct snippet hashes|
  - index candidate fingerprints by hash in a `Map<number, number[]>`
  - for each matched snippet k-gram, pair it with the candidate occurrence closest in order to the previous pairing
  - merge pairs whose token spans touch or overlap into regions, and map them to lines via `token.line`
  - renames come from aligned `ID` tokens inside paired k-grams: count `from→to` pairs, keep each `from`'s most frequent `to`, and drop identical pairs
- [ ] **Step 4:** Run it. Expected: PASS. **Step 5:** Commit `feat(trace): compare fingerprints, regions and renames`.

### Task 6: Search queries

**Files:** Create `domain/queries.ts`, `domain/queries.test.ts`

**Interfaces:**

- Consumes: `Token`, `Language`.
- Produces: `interface SearchQuery { kind: "exact" | "structural" | "anchor"; pattern: string; regex: boolean }` and `buildQueries(source: string, tokens: Token[]): SearchQuery[]` (order: exact, structural, then anchors).

- [ ] **Step 1: Write the failing tests:**
  - exact: the longest trimmed source line of at least 20 characters, with `regex: false`. When no line reaches 20, there is no exact query.
  - structural: for `let acc = 0;\nfor (const v of values) acc += v;` the pattern is `let\s+\w+\s*=\s*\d[\w.]*\s*;\s*\n\s*for\s*\(\s*const\s+\w+\s+of\s+\w+\s*\)\s*\w+\s*\+=\s*\w+\s*;`, with `regex: true`.
  - The structural pattern spans at most 3 lines, chosen as the 3 consecutive lines with the most tokens.
  - Metacharacters are escaped: a snippet with `a.b(c)[0] + d*e?` gives a structural pattern containing `\.`, `\(`, `\[`, `\*` and `\?`. `new RegExp(pattern)` matches the original source line.
  - Strings become `"[^"\n]*"` (or the same with the matching quote).
  - Anchors: string literals with at least 6 characters inside the quotes, rarest first (fewest occurrences in the snippet), and member names after `.` with at least 5 characters. At most 2 of each, literal (`regex: false`), with no duplicates of the exact query.
- [ ] **Step 2:** Run it. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5:** Commit `feat(trace): build exact, structural and anchor queries`.

### Task 7: Ranking

**Files:** Create `domain/rank.ts`, `domain/rank.test.ts`. Modify `domain/types.ts`.

**Interfaces (Produces):**

```ts
export interface TraceResult {
  id: string; // `${repository}/${path}`
  repository: string; // "owner/name"
  path: string;
  url: string; // GitHub blob URL with #L<start>-L<end> of the first region
  stars: number | null;
  similarity: number;
  regions: MatchRegion[];
  renames: Rename[];
  excerpt: { startLine: number; lines: string[] }; // candidate lines around the first region, ±2, max 40
  contentHash: number; // fnv1a of the candidate's normalized values
  vendored: boolean;
  copies: number; // other results with the same contentHash, collapsed into this one
}
export function isVendoredPath(path: string): boolean;
export function rank(results: readonly TraceResult[]): TraceResult[];
```

- [ ] **Step 1: Write the failing tests:**
  - It drops results under `MIN_SIMILARITY`.
  - It orders by similarity descending, then stars descending (`null` counts as 0).
  - At equal similarity, a vendored result ranks below a non-vendored one, even with more stars.
  - `isVendoredPath` is true for `node_modules/x.js`, `a/vendor/b.go`, `dist/app.js` and `lib/x.min.js`, and false for `src/vendors.ts`.
  - Results with equal `contentHash` collapse into one: the representative is the non-vendored one with most stars, and `copies` is the number of others.
  - It is pure: the input array is not mutated.
- [ ] **Step 2:** Run it. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5:** Commit `feat(trace): rank and collapse results`.

### Task 8: Sourcegraph provider

**Files:** Create `providers/types.ts`, `providers/sourcegraph.ts`, `providers/sourcegraph.test.ts`, `providers/__fixtures__/sourcegraph-matches.txt`, `providers/__fixtures__/sourcegraph-malformed.txt`

**Interfaces (Produces):**

```ts
export interface SearchHit { provider: ProviderName; repository: string; path: string; commit: string; stars: number | null }
export type ProviderName = "sourcegraph" | "github";
export type ProviderStatus = "ok" | "rate-limited" | "timeout" | "error";
export class ProviderError extends Error { constructor(public status: Exclude<ProviderStatus, "ok">, message: string) }
export interface SearchProvider {
  name: ProviderName;
  supportsRegex: boolean;
  search(query: SearchQuery, options: { language: Language; limit: number; signal: AbortSignal }): Promise<SearchHit[]>;
}
export function createSourcegraphProvider(options?: { baseUrl?: string; fetch?: typeof fetch }): SearchProvider;
```

- [ ] **Step 1:** Record the fixture with `curl -s -H "Accept: text/event-stream" "https://sourcegraph.com/.api/search/stream?q=context:global%20clearTimeout%5C(%5Cw%2B%5C)%20patterntype:regexp%20lang:javascript%20count:5" > providers/__fixtures__/sourcegraph-matches.txt`. Write the malformed fixture by hand: one valid `matches` event, one `data: {not json`, and one `matches` event whose item lacks `repository`.
- [ ] **Step 2: Write the failing tests** (MSW serves the fixtures at `https://sourcegraph.com/.api/search/stream`):
  - The request query string contains `context:global`, the pattern, `patterntype:regexp` for regex queries or `patterntype:literal` for literal ones, `lang:javascript` (omitted for `generic`), `count:<limit>`, and `fork:no`.
  - It parses hits from the recorded fixture. `repository` drops the `github.com/` prefix, and `stars` comes from `repoStars`.
  - It skips non-github.com repositories.
  - Malformed fixture: it returns only the valid hit and does not throw.
  - HTTP 429 rejects with `ProviderError` status `"rate-limited"`. An abort rejects with status `"timeout"`, and a 500 with `"error"`.
- [ ] **Step 3:** Run it. Expected: FAIL.
- [ ] **Step 4:** Implement: SSE parsing over `response.text()` (split on blank lines, read `event:`/`data:`), with Zod schemas per match item and invalid items skipped.
- [ ] **Step 5:** Run it. Expected: PASS. **Step 6:** Commit `feat(trace): search sourcegraph`.

### Task 9: GitHub provider and file content

**Files:** Create `providers/github.ts`, `providers/github.test.ts`, `providers/content.ts`, `providers/content.test.ts`

**Interfaces (Produces):** `createGithubProvider(options: { token: string; fetch?: typeof fetch }): SearchProvider` (with `supportsRegex: false`), and `fetchFileContent(hit: SearchHit, options: { signal: AbortSignal; fetch?: typeof fetch }): Promise<string | null>`.

- [ ] **Step 1: Write the failing tests:**
  - The GitHub request goes to `https://api.github.com/search/code?q=<pattern> language:<lang>&per_page=<limit>` with an `Authorization: Bearer <token>` header. Regex queries are never sent (the provider resolves `[]` for `regex: true`).
  - It maps `items[].repository.full_name`, `path`, and the commit parsed from `html_url` (`/blob/<sha>/`). `stars` is `null`.
  - 403 with `x-ratelimit-remaining: 0`, or a 429, rejects with `"rate-limited"`.
  - `fetchFileContent` requests `https://raw.githubusercontent.com/<repo>/<commit>/<path>` and returns its text. A non-200 returns `null`. A `content-length` over `MAX_FILE_BYTES`, or a body over that size, returns `null`. Content with a NUL byte in the first 1024 characters (binary) returns `null`.
- [ ] **Step 2:** Run it. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5:** Commit `feat(trace): search github and fetch file content`.

### Task 10: The trace use case

**Files:** Create `server/run-trace.ts`, `server/run-trace.test.ts`

**Interfaces:**

- Consumes: everything from Tasks 1–9.
- Produces:

```ts
export type TraceEvent =
  | { type: "started"; language: Language; queries: number }
  | { type: "result"; result: TraceResult }
  | { type: "provider"; provider: ProviderName; status: ProviderStatus }
  | { type: "done"; total: number }
  | { type: "error"; code: "too-short"; message: string };
export interface TraceDeps {
  providers: SearchProvider[];
  fetchContent: (
    hit: SearchHit,
    o: { signal: AbortSignal },
  ) => Promise<string | null>;
  timeoutMs?: number;
} // timeoutMs defaults to 8000
export function runTrace(
  input: { code: string; language?: Language },
  deps: TraceDeps,
  signal: AbortSignal,
): AsyncGenerator<TraceEvent>;
```

- [ ] **Step 1: Write the failing tests** (fake providers and a fake `fetchContent` that serve `pairs.ts` content, no MSW):
  - A snippet under `MIN_TOKENS` yields exactly one event, `{ type: "error", code: "too-short", message: "This snippet is too short to trace. Paste a few lines, at least 20 tokens." }`.
  - Happy path: it yields `started` first and `done` last. Every `result` has `similarity >= MIN_SIMILARITY`, and `done.total` equals the number of `result` events.
  - Regex queries only go to providers with `supportsRegex`.
  - Duplicate hits from several queries or providers are fetched once.
  - At most `MAX_CANDIDATES` fetches, and at most `FETCH_CONCURRENCY` in flight (tracked with a counter in the fake).
  - A provider that rejects with `ProviderError("rate-limited")` yields `{ type: "provider", provider, status: "rate-limited" }`, and other providers' results still arrive.
  - A provider that never resolves is cut off at the timeout (inject `timeoutMs: 50` in `TraceDeps`) and yields status `"timeout"`.
  - Aborting `signal` after `started` stops the generator, and the fakes observe `signal.aborted === true`.
  - `language` defaults to `detectLanguage(code)`.
- [ ] **Step 2:** Run it. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5:** Commit `feat(trace): run a trace as a stream of events`.

### Task 11: API route, rate limit, cache and e2e mocks

**Files:** Create `server/rate-limit.ts`, `server/cache.ts`, `server/ndjson.ts` with tests, `src/app/api/trace/route.ts`, `src/app/api/trace/route.test.ts`, `src/instrumentation.ts`, `src/test/msw/trace-handlers.ts`, `domain/examples.ts`

**Interfaces (Produces):**

- `createRateLimiter({ limit, windowMs, now? }): { take(key: string): boolean }`
- `createTraceCache({ max, ttlMs, now? }): { get(key: string): TraceEvent[] | undefined; set(key: string, events: TraceEvent[]): void }`
- `toNdjsonStream(events: AsyncIterable<unknown>): ReadableStream<Uint8Array>`
- `EXAMPLE_SNIPPET: { language: Language; code: string }` (a debounce function of about 10 lines), whose Sourcegraph fixture lives in `trace-handlers.ts`.

- [ ] **Step 1: Write the failing tests:**
  - Rate limiter: the 11th `take("ip")` within 60s is `false`, `take("other")` is still `true`, and after the window passes (injected `now`) it is `true` again.
  - Cache: it expires after the TTL and evicts the least recently used entry beyond `max`.
  - NDJSON: each event is one `JSON.stringify` line ending in `\n`.
  - Route (`POST` called directly with a `Request`, providers mocked by MSW):
    - an invalid body (missing `code`, an unknown `language`, `code` over 20,000 characters) gets 400 with `{ error: "invalid-input" }`
    - the 11th request from the same `x-forwarded-for` gets 429 with `{ error: "rate-limited", message: "Too many traces in a minute. Try again shortly." }`
    - success gets 200 with `content-type: application/x-ndjson`, and the body lines parse into events ending with `done`
    - a second identical request is served from the cache (MSW sees a single Sourcegraph request)
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement. The route builds providers from `env`, adding GitHub only if `env.GITHUB_TOKEN` exists. The cache key is `${language}:${fnv1a(normalized values joined)}`. `instrumentation.ts` has `export async function register() { if (process.env.CODEPRINT_E2E_MOCKS === "1" && process.env.NEXT_RUNTIME === "nodejs") { const { server } = await import("@/test/msw/server"); const { traceHandlers } = await import("@/test/msw/trace-handlers"); server.use(...traceHandlers); server.listen({ onUnhandledFrame: "bypass" }); } }`. Add `CODEPRINT_E2E_MOCKS: "1"` to Playwright's `webServer.env`.
- [ ] **Step 4:** Run `pnpm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(trace): serve traces over ndjson with rate limiting and caching`.

### Task 12: Trace input UI

**Files:** Create `ui/code-editor.tsx`, `ui/language-select.tsx`, `ui/use-trace.ts`, `src/shared/ui/kbd.tsx`, with tests

**Interfaces (Produces):**

- `<CodeEditor value onChange onSubmit />`: a textarea labelled "Code snippet" with a line-number gutter. `Ctrl+Enter` and `⌘+Enter` call `onSubmit`.
- `<LanguageSelect value detected onChange />`: a native `select` labelled "Language". The first option is `Auto-detect (<Label>)`, value `"auto"`.
- `useTrace(): { state: "idle" | "tracing" | "done" | "error"; results: TraceResult[]; providers: Partial<Record<ProviderName, ProviderStatus>>; error: string | null; trace(input): void; cancel(): void }`. It reads the NDJSON stream, keeps `results` ranked with `rank`, and aborts the previous request when a new trace starts.

- [ ] **Step 1: Write the failing tests:**
  - The editor shows one gutter number per line (3 lines show "1 2 3"), and `Ctrl+Enter` and `Meta+Enter` call `onSubmit` once while plain `Enter` inserts a newline.
  - The select's first option reads "Auto-detect (Python)" when `detected="python"`, and choosing "Go" calls `onChange("go")`.
  - `useTrace`, with MSW serving NDJSON:
    - results arrive incrementally (the state is `"tracing"` with 1 result before `done`), and the state is `"done"` after
    - a `too-short` error event gives the state `"error"` with the exact message
    - a 429 response gives the rate-limit message
    - calling `trace` twice aborts the first request
- [ ] **Step 2:** Run it. Expected: FAIL. **Step 3:** Implement. **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5:** Commit `feat(trace): add snippet input and streaming client`.

### Task 13: Results UI and the page

**Files:** Create `ui/similarity-meter.tsx`, `ui/result-card.tsx`, `ui/comparison-view.tsx`, `ui/scanning-print.tsx`, `ui/trace-view.tsx` with tests. Modify `src/app/(tools)/trace/page.tsx`, `src/shared/lib/tools.ts`, `src/shared/lib/tools.test.ts`, `src/app/globals.css`

**Interfaces:**

- Consumes: `useTrace`, `TraceResult`, `EXAMPLE_SNIPPET`.
- Produces: `<TraceView />`, the whole client page.

- [ ] **Step 1: Write the failing tests:**
  - `SimilarityMeter value={0.87}` renders `role="meter"` with `aria-valuenow=87`, `aria-valuemin=0`, `aria-valuemax=100` and the visible text "87% similar".
  - `ResultCard`:
    - shows `repository`, `path`, stars formatted with `Intl.NumberFormat("en", { notation: "compact" })` (`12400` shows "12.4K"), and a link named "Open on GitHub" to `url`, opening in a new tab with `rel` containing `noopener`
    - shows "Also found in 3 other copies" when `copies` is 3, and "Vendored copy" when `vendored`
    - the "Compare" button toggles `aria-expanded` and reveals the `ComparisonView`
  - `ComparisonView` renders two labelled regions, "Your snippet" and the repository name. Matched lines have `data-matched="true"`, and rename chips read `acc → total`.
  - `TraceView`:
    - "Try an example" fills the editor with `EXAMPLE_SNIPPET.code`
    - the empty-results `done` state shows the exact no-matches copy
    - a provider status of `"error"` or `"timeout"` for Sourcegraph shows the exact partial copy
    - the `aria-live` region announces "Tracing…" while tracing and "<n> matches found" when done
  - Registry: Trace's `status` is `"available"` (update the Phase 1 test, which asserted that every tool was coming soon, so it now asserts that only the other three are).
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement per visual-direction.md. `ScanningPrint` reuses `buildRidges` with a CSS scan sweep (a keyframe on a gradient mask), and `animation: none` under reduced motion. Result cards use `Card`. The comparison uses `font-mono`, with matched lines on an `accent-soft` background. The page exports `metadata` from `toolMetadata("trace")` and renders a heading `h1` "Trace" plus `<TraceView />`.
- [ ] **Step 4:** Run `pnpm test`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(trace): show ranked results with comparison`.

### Task 14: End-to-end, docs and wrap-up

**Files:** Create `tests/e2e/trace.spec.ts`. Modify `README.md`, `docs/adr/0002-trace-providers-and-matching.md` (create), `.env.example`, `tests/e2e/navigation.spec.ts` (if Trace's heading or links changed)

- [ ] **Step 1: Write the e2e tests** (the server runs with `CODEPRINT_E2E_MOCKS=1`):
  - "Try an example", then Trace: at least one result card appears, the first shows a similarity of at least 80% and "Open on GitHub", and "Compare" shows rename chips.
  - Pasting `let a = 1;` and pressing `Control+Enter` shows the too-short message.
  - Keyboard only: tab into the editor, type, press `Control+Enter`, and the results get announced (the live region text matches `/matches found/`).
  - Reduced motion: no running animations while tracing.
  - At 360px, no horizontal scroll with results expanded.
- [ ] **Step 2:** Run `pnpm test:e2e`. Expected: PASS (fix code, not tests, on failure).
- [ ] **Step 3:** Docs: the README "How Trace works" section becomes present tense, with the parameters table and the limits ("public code indexed by Sourcegraph and, with a token, GitHub; short or very common snippets can't be traced"). ADR 0002 records the provider spike and the NDJSON choice. `.env.example` notes that `GITHUB_TOKEN` is optional and widens coverage.
- [ ] **Step 4:** Run `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm build`. Expected: all pass.
- [ ] **Step 5:** Commit `docs: document trace`, push, open the PR `Phase 2: Trace`, and ask the owner before merging.
