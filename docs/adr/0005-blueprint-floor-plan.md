# ADR 0005: Blueprint draws a repository as a floor plan

- **Status:** Accepted
- **Date:** 2026-11-03

## Context

Blueprint should show how a repository is built at a glance: what its parts are, how big they are and how they depend on each other. It has to work on a small library and on a very large monorepo, within GitHub's unauthenticated limits.

## Decision

- **Pipeline:** GitHub → files → modules and edges → `PlanModel` → SVG. Everything after the fetch is pure.
- **Rooms:** modules become rooms in a squarified treemap, sized by bytes with a minimum share so small modules stay visible.
- **Modules:** organizing folders such as `src` and `packages` are always opened, and supporting folders such as `test` and `examples` stay in one room each. Otherwise a repository's real structure hides inside one huge room, and its imports look internal.
- **Pipes:** resolved imports between modules become orthogonal pipes, thicker for more imports. Relative, `@/` and Python imports are resolved (`src/` layouts included), as are monorepo packages imported by the name in their `package.json`.
- **Sampling:** dependencies are read from up to 300 files, largest first in each module, in the languages we can parse. The page says when a plan is based on this sample, or when a language isn't read.
- **Labels:** long names are shortened from the left, because the end of a path is what tells modules apart.

## Consequences

- Plans are reproducible and unit-testable, but on very large repositories the pipes are only a sample.
- Package imports only resolve in `packages/*`, to a `src/index` or `index` entry point. Other workspace layouts and path aliases show fewer pipes.
- File marks are capped by the room's space and at 400 to keep the SVG light, so they show how full a room is, not an exact count. The table has the real number.
- Pipes can cross room labels in crowded corners. Selecting a room in the table dims the others, and the plan can be zoomed.
