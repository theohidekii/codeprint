# ADR 0002: Trace providers, matching and streaming

- **Status:** Accepted
- **Date:** 2026-10-31

## Context

Trace has to find public code that contains a pasted snippet, including copies where identifiers were renamed. Codeprint has no code index of its own, and it runs locally without paid services.

We checked the candidate search services on 2026-10-31:

| Service                           | Finding                                                                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Sourcegraph `/.api/search/stream` | Anonymous access works. It supports regex (including multi-line) and streams server-sent events with repository, path, commit and stars. |
| GitHub code search API            | Requires a token. Literal search only.                                                                                                   |
| grep.app API                      | Blocked for server calls by a bot checkpoint (HTTP 429).                                                                                 |
| `raw.githubusercontent.com`       | Serves file contents at a commit anonymously.                                                                                            |

## Decision

- **Sourcegraph is the primary provider.** GitHub is added only when `GITHUB_TOKEN` is set. grep.app is not used.
- **Match on normalized tokens, not text.**
  - Identifiers, strings and numbers become placeholders.
  - Fingerprints come from winnowing (k = 5, window = 4).
  - Similarity is the share of the snippet's fingerprints found in the candidate.
  - Matched fingerprints grow into the longest equal token runs. Runs shorter than 10 tokens count toward similarity but are ignored when locating code and naming renames, because short shapes such as `function ID ( ID ) {` appear everywhere.
  - Renames come only from the largest matching region.
- **Bridge text search and structure with three query kinds:**
  - an exact line
  - a structural regex with identifiers as `\w+`
  - rare string and member anchors
- **Stream everything.**
  - The provider reads Sourcegraph's event stream incrementally.
  - The server emits NDJSON events (`started`, `result`, `provider`, `done`, `error`).
  - The client re-ranks results as they arrive.
- **Be honest about partial answers.**
  - Each search has an 8 s budget. When it runs out, the search is aborted and gets 250 ms to return the hits it already has.
  - A provider whose queries only partly answered is reported as `partial`, and the UI says some searches took too long.
- **Test offline.**
  - Unit tests use MSW with recorded Sourcegraph responses.
  - End-to-end tests start the production server with `CODEPRINT_E2E_MOCKS=1`, which installs the same fixtures through `src/instrumentation.ts`.

## Consequences

- Trace works with zero configuration. Its coverage is whatever Sourcegraph indexes, plus GitHub when a token is set.
- Multi-line regex searches can exceed the budget on popular patterns (we saw 21 s live). Exact-line and anchor queries usually still return results, and the UI flags the gap.
- The thresholds are starting values pinned by fixture tests. Tuning them is a matter of editing `domain/constants.ts` and the fixtures.
- One aborted-stream test uses an injected `fetch` instead of MSW. Undici and MSW's mocked socket raise an internal assertion when a streaming body is aborted, a test-environment artifact.
