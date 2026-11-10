---
inclusion: manual
---

# Roadmap process

1. Every roadmap item is a GitHub issue with a milestone, labels (`type:`, `area:`, `priority:`) and a link to its
   spec in `.kiro/specs/<name>/`.
2. Milestones: v0.1 MVP desktop, v0.2 settings/i18n/export, v0.3 Drive BYO, v0.4 local-first sync, v1.0 signed
   releases and auto-update, Future.
3. To start an item: open its spec, refine `requirements.md` (EARS), then `design.md`, then work `tasks.md`
   top to bottom, ticking boxes. Update `ROADMAP.md` and `CHANGELOG.md` when it ships.
4. New ideas go to Discussions first; promote to an issue when scoped.
5. `scripts/gh-bootstrap.sh` recreates labels, milestones and issues idempotently.
