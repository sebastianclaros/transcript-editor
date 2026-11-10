# AGENTS.md

Guide for AI assistants (Kiro and others) working in this repository.

## What this is

Transcript Editor: a local-first Electron app to correct interview transcripts while listening to the audio.
npm workspaces monorepo. Read `.kiro/steering/*.md` (product, tech, structure, conventions) first; specs are in
`.kiro/specs/<feature>/`.

## Commands

```
npm ci
npm run lint && npm run typecheck && npm test && npm run build     # the gate
npm run dev                                                        # app on the demo session
npm run test:e2e                                                   # real Electron, needs a display
npm run check                                                      # everything plus privacy / Kiro / link checks
```

## Hard rules

1. **Never add private data**: no real audio, transcripts, names, tokens, `.env`, `config.json` with IDs.
   Use `samples/` and invent fixtures. `npm run check:privacy` must pass.
2. **Package boundaries**: `core` and `storage` import no React, Electron or Node; `ui` imports no Electron or Node.
3. **Paragraph invariant**: a loaded transcript never changes its paragraph count or order.
4. **All file access goes through `HostApi`**; the renderer never receives absolute paths.
5. **Electron security settings are not negotiable** (see `.kiro/steering/security.md`).
6. UI strings go through the dictionaries (es and en); code, commits and the main README are in English.
7. Exact dependency versions; do not push, tag or release unless asked; sign off commits with `-s`.
8. Update the matching spec `tasks.md` and the docs when behaviour changes.

## Where things are

See `.kiro/steering/structure.md`. Decisions: `docs/decisions/`. Roadmap: `ROADMAP.md`.
