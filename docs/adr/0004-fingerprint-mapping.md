# ADR 0004: Fingerprint maps data to a deterministic print

- **Status:** Accepted
- **Date:** 2026-11-03

## Context

Fingerprint draws a poster from a GitHub account. It should be shareable art, but every visual choice must be explainable, and the same input must always give the same image.

## Decision

- **Pipeline:** GitHub → `Profile` → `Traits` → `PosterModel` → SVG. Everything after the fetch is pure.
- **Mapping:** the name picks the pattern and core; languages color the ridges; weekday burstiness sets the wobble; hours draw a 24-tick UTC ring; size sets the ridge count on a log scale from 14 to 34.
- **Determinism:** all randomness comes from a mulberry32 generator seeded with the lowercased name.
- **Cheap on quota:** 3 or 4 REST requests per poster. `stats/punch_card` is avoided because it can answer 202. Only the first request is required; the rest only add detail.
- **Input safety:** targets must match a strict pattern, and dot segments are rejected, because `owner/..` would otherwise walk up the API's URL.

## Consequences

- Posters are reproducible and fully unit-testable, but activity is only a sample of the latest 100 events or commits.
- Hours are UTC, because GitHub doesn't reliably expose the author's time zone. The poster says so.
- Partial profiles are cached for 10 minutes like complete ones.
