# ADR 0001: Stack and architecture

- **Status:** Accepted
- **Date:** 2026-10-31

## Context

Codeprint is a portfolio project with four tools (Trace, Snapshot, Fingerprint, Blueprint) built in phases. It must read as clean, tested, professional code to a developer browsing the repository. Trace needs server-side calls with API tokens that must never reach the browser. The owner chose not to deploy it.

## Decision

- **One Next.js (App Router) app in TypeScript strict mode.** Route handlers give us a small server for secrets without a separate backend.
- **Feature folders.** Each tool lives in `src/features/<tool>/` with `domain/`, `providers/` and `ui/`. Shared design system code lives in `src/shared/`.
- **Pure domain.** `domain/` holds the algorithms (tokenizing, normalizing, winnowing, ranking) as plain TypeScript. An ESLint `no-restricted-imports` rule forbids React, Next.js, `ui/`, `providers/` and `app/` there.
- **Single tool registry.** `src/shared/lib/tools.ts` is the source of truth for tool names, copy, status and phase.
- **Explicit routes per tool** (`src/app/(tools)/trace/page.tsx`, …) rather than one dynamic `[tool]` route. With Cache Components, `notFound()` inside a partially prerendered dynamic route streamed a 200 status for unknown slugs. Explicit routes make unknown paths a true 404, and each tool grows into its own page anyway.
- **Testing:** Vitest and Testing Library for units and components, MSW for network (unhandled requests fail), Playwright for end to end on desktop and mobile.
- **Styling:** Tailwind CSS v4 with design tokens from `docs/design/visual-direction.md`, `next-themes` for class-based dark mode, and `motion` only for interaction feedback. The one ambient animation is pure CSS so it respects `prefers-reduced-motion` from the first paint.
- **No deployment.** It runs locally, and the README carries screenshots and a demo.

## Consequences

- Domain logic is easy to test exhaustively and could move to a package later.
- Adding a tool means adding a registry entry, a route folder and a feature folder.
- The Next.js 16 defaults (Turbopack, Cache Components) constrain some route options, such as `dynamicParams`. This ADR records why the routes are explicit.
- Without a deploy, there are no hosting costs or token exposure risks, but visitors must run it locally to try it.
