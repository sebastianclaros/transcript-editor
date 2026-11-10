---
inclusion: always
---

# Conventions

- Conventional Commits (`feat`, `fix`, `docs`, `test`, `chore`, `build`, `ci`); sign off with `git commit -s`.
- Match the surrounding style; Prettier decides formatting (`npm run format`).
- Tests live next to the layer: `packages/*/test`, `apps/desktop/test`, `apps/desktop/e2e`. Hand-compute expected
  numbers; no snapshots of computed output. Invented fixtures only.
- UI strings go through `t("key")`; add the key to `es.ts` and `en.ts` (parity is tested). Do not hard-code prose.
- Specs: `.kiro/specs/<feature>/{requirements,design,tasks}.md`, requirements in EARS form
  ("WHEN ... THE SYSTEM SHALL ..."). Tick tasks as they are done.
- ADRs for decisions that are costly to reverse: `docs/decisions/NNNN-title.md`.
- Docs: user guides in Spanish (`*.es.md`) and English; README and contributor files in English.
