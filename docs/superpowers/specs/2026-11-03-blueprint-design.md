# Blueprint (Phase 5) — Design addendum

- **Date:** 2026-11-03
- **Extends:** [Codeprint design](2026-10-31-codeprint-design.md) §8. Where this addendum is more specific, it wins.
- **Status:** Draft, awaiting approval

## 1. What it is

Enter `owner/repo` and get the repository drawn as an architect's **floor plan** on blue paper: each module is a room sized by how much code it holds, and pipes between rooms show which modules depend on which.

A floor plan, not a node-and-arrow graph. Graphs of real repositories turn into hairballs, while a plan stays readable and looks like nothing else.

## 2. Data (spike results, 2026-11-03)

| Request                                          | Cost                  | Gives                                                              |
| ------------------------------------------------ | --------------------- | ------------------------------------------------------------------ |
| `GET /repos/:o/:r`                               | 1 API call            | Default branch, full name                                          |
| `GET /repos/:o/:r/git/trees/:branch?recursive=1` | 1 API call            | Every path and size. `vercel/next.js` returned all 52,433 entries. |
| `raw.githubusercontent.com/:o/:r/:branch/:path`  | Outside the API quota | File contents, to read imports                                     |

A truncated tree is drawn from what arrived, and the page says so.

**Limits:** at most **300** source files are read, **10** at a time, up to **512 KB** each, largest first per module so every module is represented. When the limit cuts the reading, the page says "Dependencies are based on the 300 largest files."

## 3. From repository to plan (pure)

- **Ignored:** `node_modules/`, `vendor/`, `dist/`, `build/`, `.git*`, lock files, minified files, images and other binaries.
- **Modules:** files group by folder. Starting from the root, a folder holding most of the code is opened up (`src/` becomes `src/app`, `src/lib`…), until there are 6–24 modules. Root-level files form a room called `(root)`.
- **Room size:** bytes of source code, laid out with a squarified treemap.
- **Dependencies:**
  - **Resolved:** relative imports in JavaScript and TypeScript (`import`, `require`, `export from`), the `@/` alias mapped to `src/`, and Python relative and package imports.
  - **Other languages:** rooms only, no pipes, and the page says "Dependencies aren't read for this language yet."
  - Parsing reuses Trace's tokenizer, so imports inside comments and strings don't count.
- **Pipes:** one per pair of modules, thicker with more imports. The top 40 by weight are drawn.
- **Hotspots:** up to 3 rooms marked, ranked by size × connections. Each gets a drafting callout saying why ("largest", "most connected").

Everything is deterministic: same files, same plan.

## 4. The drawing

- Cyanotype by default, plus a Latent Dark and a Paper version. White drafting lines, double walls, room labels with size and file count, a title block in the corner (repository, modules, files, top language) and a `codeprint` mark.
- Long names shorten with `…`, and rooms too small for a label show a number keyed to a list under the plan.
- Sizes: Landscape 1600×1000 (default), Square 1080×1080, LinkedIn 1200×627.
- Export: PNG at 2×, SVG, Copy image, using the shared code.

## 5. Server and UI

- `GET /api/blueprint?target=owner/repo` returns `{ repository, branch, files, truncated, modules, edges, unreadLanguages, sampled }` as JSON. Validation reuses `isValidTarget`, and a target with no `/` gets `400` with "Enter a repository as owner/repo."
- Safeguards: 10 requests per minute per client, a 10-minute cache (complete results only), 8 s per request, a 25 s budget overall. The same rate-limit and not-found messages as Fingerprint.
- `/blueprint`: an input, **Generate**, **Try an example** (`vercel/swr`, small and readable), and a progress status. The preview supports zoom and pan (buttons, wheel, drag, and arrow keys), with a **room list** table beside it as the accessible equivalent of the drawing. Selecting a room in the list highlights it and its pipes.

## 6. Not in scope

- Function or class-level analysis, and resolving imports across languages.
- `tsconfig` path aliases other than `@/`.
- Private repositories.

## 7. Calls I made (owner can veto)

- **Floor plan instead of a graph.** It costs some precision about direction (pipes show a connection and its weight, with a small arrow for the dominant direction).
- **Imports resolved only for JS/TS and Python** in this phase.
- **300 files read per repository**, so huge repositories are a sample, and the page says so.
- **`vercel/swr` as the example.**
