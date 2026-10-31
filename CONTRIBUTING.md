# Contributing

Thanks for taking a look. Codeprint follows a few conventions so the code stays easy to read and safe to change.

## Workflow: red, green, refactor

Every behavior change starts with a test:

1. **Red:** write a test for the behavior and run it. Watch it fail for the right reason (the feature is missing, not a typo).
2. **Green:** write the smallest code that makes it pass.
3. **Refactor:** clean up with the tests green.

Bug fixes start with a test that reproduces the bug.

## Where tests live

- Unit and component tests sit next to the code: `thing.ts` and `thing.test.ts`.
- End-to-end tests live in `tests/e2e/`.
- Tests never hit the network. Use MSW handlers (`src/test/msw/`) with `server.use(...)` inside a test.

Run everything before you push:

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```

## Architecture rules

- `src/app/` routes stay thin. They compose features and hold no logic.
- `src/features/<tool>/domain/` is pure TypeScript. It must not import React, Next.js, `ui/`, `providers/` or `app/`. ESLint enforces this.
- External APIs go behind an interface in `providers/`, so they can be swapped and mocked.
- Validate data at every boundary with Zod: environment, API input and provider responses.
- Secrets stay on the server. `src/env.ts` imports `server-only`.

## Style

- TypeScript `strict`, plus `noUncheckedIndexedAccess`.
- Prettier formats everything. Don't hand-format.
- Code, comments, docs and UI copy are in English.
- UI copy is in sentence case, uses plain verbs and says what happens ("Trace a snippet", not "Submit").

## Commits and branches

- [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `ci:`, `refactor:`.
- Work on a branch and open a pull request into `main`. CI (quality, unit, e2e) must pass before merging.
