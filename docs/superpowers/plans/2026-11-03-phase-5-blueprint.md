# Phase 5 — Blueprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At `/blueprint`, enter `owner/repo` and explore and export a floor plan of its modules and dependencies.

**Architecture:** The server reads the tree and up to 300 files, then returns an analysis built by pure functions (`modules`, `imports`, `edges`, `hotspots`). The client lays it out with a pure treemap, renders SVG with a pure renderer, and reuses the shared export code.

**Tech Stack:** As in earlier phases. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-03-blueprint-design.md` (wins where more specific).

## Global Constraints

- All earlier Global Constraints apply: English, strict TS, TDD, Conventional Commits with the co-author line, branch plus PR, no network in tests, AA text contrast, reduced motion, 360px.
- Branch `phase-5-blueprint`. Merge only after the owner approves.
- Run `pnpm typecheck` and `pnpm lint` before every commit.
- Values: 6–24 modules, 300 files, 10 at a time, 512 KB each, 40 pipes, 3 hotspots, 10 requests/min, 8 s per request, 25 s overall, cache 50 entries for 10 minutes.

## Review Focus

1. **Hostile paths and content:** file names with `<`, `#`, spaces or `..`, and import strings like `../../../etc` must be encoded in URLs, escaped in SVG, and never resolve outside the repository. Pinned in Tasks 1, 2 and 4.
2. **Degenerate repositories:** empty, one file, no source files, all files in root, a truncated tree, and Go or Rust only give a valid plan or a clear message. Pinned in Tasks 1 and 3.
3. **Huge repositories:** 50,000 paths analyze in under 200 ms, and the 25 s budget returns what arrived, flagged. Pinned in Tasks 1 and 3.
4. **Treemap geometry:** rooms never overlap or leave the plan, including a module holding 99.9%. Pinned in Task 4.
5. **Abort:** a client disconnect stops file downloads and caches nothing. Pinned in Task 3.

---

## File Structure

```
src/features/blueprint/
  domain/
    modules.ts   groupModules(files) → Module[]
    imports.ts   extractImports(source, language), resolveImport(from, spec, paths)
    edges.ts     buildEdges(...), pickHotspots(...)
    treemap.ts   squarify(sizes, box)
    plan.ts      layoutPlan(analysis, options) → PlanModel
    render-plan.ts  renderPlan(model, theme, fonts) → SVG
  server/
    analyze.ts   analyzeRepository(target, deps) → Analysis
  ui/
    blueprint-view.tsx  use-blueprint.ts  plan-viewport.tsx  room-list.tsx
src/app/api/blueprint/route.ts
src/app/(tools)/blueprint/page.tsx
src/test/msw/blueprint-handlers.ts
tests/e2e/blueprint.spec.ts
```

---

### Task 1: Modules

**Interfaces:** `interface RepoFile { path: string; size: number }`, `interface Module { id: string; name: string; bytes: number; files: number; paths: string[] }`, `isSourcePath(path): boolean`, `groupModules(files: RepoFile[]): Module[]` (sorted by bytes, descending).

- [ ] **RED:**
  - Ignored paths are dropped (`node_modules/`, `vendor/`, `dist/`, `build/`, lock files, `.min.`, images).
  - `src/` holding most code opens into `src/app`, `src/lib`.
  - Root files form `(root)`.
  - The result stays within 6–24 modules when there are enough folders, merging the smallest into `(other)`.
  - One file gives one module. No source files gives `[]`.
  - 50,000 paths take under 200 ms.
- [ ] **GREEN**, then commit `feat(blueprint): group files into modules`.

### Task 2: Imports and edges

**Interfaces:** `extractImports(source: string, language: Language): string[]`, `resolveImport(fromPath: string, spec: string, known: ReadonlySet<string>): string | null`, `interface Edge { from: string; to: string; weight: number }`, `buildEdges(imports: { path: string; specs: string[] }[], modules: Module[]): Edge[]` (top 40), `pickHotspots(modules, edges): { moduleId: string; reason: "largest" | "most connected" }[]` (at most 3).

- [ ] **RED:**
  - `import`, `export from`, `require()` and dynamic `import()` are found. The same text in comments or strings is not. Python `from .a import b` and `import pkg.mod` are found.
  - Resolution handles `./x` with `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `/index.*` and `/__init__.py`, plus `@/x` to `src/x`. Packages give `null`. `../../../etc` above the root gives `null`.
  - Imports within a module make no edge. Pairs are weighted and capped at 40, deterministically.
  - Hotspots are ordered by size × (connections + 1). A repo with no edges has only "largest".
- [ ] **GREEN**, then commit `feat(blueprint): resolve imports into dependencies`.

### Task 3: Analysis and route

**Interfaces:** `analyzeRepository(target, { token?, fetch?, signal?, budgetMs? }): Promise<Analysis>`, where `Analysis` is the addendum §5 shape plus `partial?: true`. Reuse `ProfileError`, moving its rate-limit detection to `src/shared/server/github.ts`.

- [ ] **RED** (MSW, fixtures in `blueprint-handlers.ts`, added to `instrumentation.ts`):
  - The happy path gives modules and edges from a small fixture repo.
  - Reads are capped at 300 files, 10 in flight, every module represented, largest first. `sampled` is true when cut.
  - Paths with `#` and spaces are encoded in raw URLs. Oversized and binary files are skipped.
  - A truncated tree sets `truncated`. Go-only sets `unreadLanguages`. An empty repo (`409`/`404` on the tree) gives no modules.
  - The budget returns what arrived with `partial`. An abort rejects.
  - Route: no `/` or invalid gets `400` with the exact message and no request. `404`, `429` and `502` follow Fingerprint. Limit 10/min. Cache by lowercased target, complete results only.
- [ ] **GREEN**, then commit `feat(blueprint): analyze repositories`.

### Task 4: Treemap, plan and SVG

**Interfaces:** `squarify(sizes: number[], box: Rect): Rect[]`, `layoutPlan(analysis, { theme, size }): PlanModel`, `renderPlan(model, theme, fonts?): string`.

- [ ] **RED:**
  - Across generated inputs, including 99.9% in one module and 24 equal ones, rooms don't overlap, stay in the box, cover it, and have areas proportional to size (±1%).
  - It is deterministic. Exact sizes match each preset.
  - Labels that don't fit shorten, then fall back to numbers.
  - Pipes join room edges, with width growing by weight.
  - Hotspot callouts appear, and the title block holds repository, modules, files and top language.
  - SVG parses, is byte-identical across runs, and hostile names render as text. `data-room` and `data-pipe` attributes support highlighting.
- [ ] **GREEN**. Then render contact sheets from a real repository and look at them, fixing what they reveal test-first. Commit `feat(blueprint): draw the floor plan`.

### Task 5: UI

- [ ] **RED** (MSW):
  - The labelled input, Generate, Enter and Try an example (`vercel/swr`) work. Invalid input shows the message without a request and clears the old plan. Progress is in `role="status"`, and server errors in `role="alert"`.
  - The preview `img` is named "Floor plan of <repo>".
  - Zoom in, zoom out and reset buttons work, as do arrow keys when focused. Zoom stays within 1×–6×.
  - The room list is a table with name, size, files and connections. Selecting a row highlights the room and its pipes in the preview.
  - Notices appear for sampled, truncated and unread languages. Theme and size change without a new request. Downloads are named after the repository, and PNG failures and Copy behave as in Fingerprint.
  - Registry: Blueprint is `available`.
- [ ] **GREEN**, then commit `feat(blueprint): build the blueprint page`.

### Task 6: E2E, docs, wrap-up

- [ ] **E2E** (mocked): the example generates and the PNG is 3200×2000. LinkedIn is 2400×1254. A missing repo shows its message. Keyboard flow works. 360px has no horizontal scroll. Reduced motion has no running animations.
- [ ] **Live check** with `vercel/swr` and `vercel/next.js`. Look at both, and fix findings test-first.
- [ ] **Docs:** a README section with a real plan, ADR 0005, and removal of remaining "Phase" statuses.
- [ ] Run everything, commit `docs: document blueprint`, push, open `Phase 5: Blueprint`, run the final review, fix Critical and Important findings test-first, and ask the owner before merging.
