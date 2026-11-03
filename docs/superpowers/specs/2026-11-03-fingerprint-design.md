# Fingerprint (Phase 4) — Design addendum

- **Date:** 2026-11-03
- **Extends:** [Codeprint design](2026-10-31-codeprint-design.md) §8. Where this addendum is more specific, it wins.
- **Status:** Draft, awaiting approval

## 1. What it is

Enter a GitHub user or `owner/repo` and get a poster: a fingerprint drawn from that account's public activity. The same input always gives the same print, and every visual choice can be traced back to real data. It is made to be posted: people share their own print.

It is art with a legend, not a dashboard. The poster has one image, one name and a few facts.

## 2. Data (spike results, 2026-11-03)

All of these answer without a token, with a limit of 60 requests per hour per IP (5,000 with `GITHUB_TOKEN`).

| Input    | Requests                                                                                                                                    | Gives                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **User** | `GET /users/:u`, `GET /users/:u/repos?per_page=100&sort=pushed`, `GET /users/:u/events/public?per_page=100`                                 | Name, repo languages and sizes, stars, and recent activity timestamps |
| **Repo** | `GET /repos/:o/:r`, `GET /repos/:o/:r/languages`, `GET /repos/:o/:r/commits?per_page=100`, `GET /repos/:o/:r/git/trees/:branch?recursive=1` | Language byte shares, commit timestamps, and file sizes               |

So one poster takes 3–4 requests. `stats/punch_card` is skipped because it can answer `202` while GitHub computes it.

**Normalized profile** (the only thing the rest of the feature sees):

```ts
interface Profile {
  kind: "user" | "repo";
  name: string; // "torvalds" or "vercel/next.js"
  languages: { name: string; share: number }[]; // top 5 + "Other", shares sum to 1
  hours: number[]; // 24 counts, UTC
  weekdays: number[]; // 7 counts, UTC, Sunday first
  sizes: { count: number; median: number }; // repos (KB) or files (bytes)
  stars: number;
  sampled: number; // how many timestamps the rhythm is based on
}
```

Hours are **UTC** and the poster says so, because GitHub doesn't reveal the author's time zone reliably.

## 3. From data to print

A pure function maps the profile to traits, and every trait has a reason:

| Data                      | Visual                                                                              | Meaning                                                  |
| ------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------- |
| The name, hashed          | Pattern (loop, whorl or arch) and core position                                     | Identity: why two accounts differ even with similar data |
| Language shares           | Ridge colors: bands of ridges proportional to each language's share                 | What this code is made of                                |
| Weekday rhythm            | Ridge wobble: steady activity draws calm lines, bursty activity draws restless ones | How the work happens                                     |
| Active hours              | A 24-tick ring around the print, each tick as long as that hour's activity          | When the work happens                                    |
| Size (repo or file count) | Ridge count, on a log scale between 14 and 34                                       | How much there is                                        |

All randomness comes from a seeded generator (seed = hash of the normalized name). Same data, same SVG, byte for byte.

**An account with no public activity** still gets a print from its name alone: a monochrome print with an empty ring and the line "Not much public activity yet."

## 4. The poster

- **Sizes:** Portrait 1080×1350 (the LinkedIn feed's best format, default), Square 1080×1080, Landscape 1200×627.
- **Themes:** Latent Dark (default), Latent Light, Cyanotype and Paper, reusing Snapshot's theme objects. Language colors come from a per-theme palette of 6 colors that reach at least 3:1 against the background (graphics contrast).
- **Text:** the name large, in Schibsted Grotesk Bold; one line of facts (`12.4K stars`, `TypeScript 68%`, `peak 14:00 UTC`); the small language legend; and a discreet `codeprint` mark. Long names shrink to fit.
- **Export:** PNG at 2×, SVG, Copy image, reusing Snapshot's export code.

## 5. Server

`GET /api/fingerprint?target=<user or owner/repo>` returns the `Profile` as JSON.

- **Validation:** `target` must match `^[A-Za-z0-9-]{1,39}(/[A-Za-z0-9._-]{1,100})?$`. Anything else gets `400`, so user input never reaches a GitHub URL unchecked.
- **Errors:**
  - Not found: "No public GitHub user or repository with that name."
  - GitHub rate limit: "GitHub's limit for anonymous requests is used up. Try again in a while, or set GITHUB_TOKEN."
  - Other failures: "GitHub didn't respond. Try again shortly."
- **Safeguards:** 20 requests per minute per client, an 8 s timeout per GitHub request, and a 10-minute cache keyed by the lowercased target.
- **Partial data:** if the events, commits or tree request fails (empty repositories answer `409`), the poster is still made with what arrived. Only the first request is required.
- **E2E mocks:** the same seam as Trace, with fixtures for `api.github.com`.

## 6. UI (`/fingerprint`)

- An input labelled "GitHub user or repository", a **Generate** button, and **Try an example** (`vercel/next.js`). Pressing Enter submits.
- While loading, the existing `ScanningPrint`. Then the poster preview (the same `<img>` approach as Snapshot) with Theme and Size choices, the export buttons and a short "How to read it" list explaining §3 in plain words.
- Theme and size changes re-render instantly, with no new request.

## 7. Refactor that comes first

`ridges`, the export helpers, the rate limiter and the cache are now used by more than one feature, so they move to `src/shared/`. Snapshot's and Trace's behavior doesn't change, and their tests move with them.

## 8. Not in scope

- GitHub login or private data.
- Comparing two prints, or galleries.
- Local-time hours.
- Language colors matching GitHub's own (palette harmony matters more on a poster).

## 9. Calls I made (owner can veto)

- **The mapping in §3**, especially the name hash deciding the pattern.
- **Hours in UTC**, stated on the poster.
- **Portrait as the default size**, since it takes the most feed space on LinkedIn.
- **`vercel/next.js` as the example**, a repository rather than a person.
