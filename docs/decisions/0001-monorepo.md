# 0001. Monorepo with npm workspaces

Status: accepted

## Context

A desktop app now; a web/cloud edition and a Drive provider later. The rules (parsers, states, stats) must be
reusable and testable without Electron.

## Decision

One repository with npm workspaces: source-only internal packages `core`, `storage`, `ui`, plus `apps/desktop` and
`apps/web` (placeholder). Boundaries are enforced by ESLint and `scripts/check-boundaries.mjs`. Product name,
app id and repository live in `brand.json`.

## Consequences

One lockfile and one CI. No per-package publishing or build step (Vite bundles the TypeScript sources).
Renaming the npm scope `@transcript-editor/*` later is a mechanical rewrite and is not covered by the
`brand.json` rename guarantee. Rejected: pnpm/turborepo (extra tooling for three packages) and draw.io's
submodule layout (we start from zero).
