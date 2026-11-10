---
inclusion: always
---

# Tech

- TypeScript 5.9 strict, ESM sources. Node >= 22.12 (`.nvmrc`), npm workspaces.
- React 18.3 (plain CSS, dark theme variables), zod 3 for every schema, Vitest 3 + Testing Library + fast-check,
  Playwright for Electron E2E, ESLint 9 flat config, Prettier.
- Electron 41.3.0, electron-vite 4.0.1, electron-builder 25.1.8. Main and preload are bundled as CommonJS `.cjs`.
- **All dependency versions are exact** (no `^` or `~`). Record bundler and Electron changes in `docs/decisions/0002-*.md`.

## Commands

```
npm ci && npm run lint && npm run typecheck && npm test && npm run build   # the gate
npm run dev            # app on samples/demo-session (TRANSCRIPT_EDITOR_DEV_OPEN)
npm run test:e2e       # needs a display (xvfb-run in CI)
npm run dist:dir       # unpacked build; dist:linux / dist:mac / dist:win for installers
npm run check          # everything plus privacy, Kiro and link checks
```

## Rules of thumb

- Rules live in `packages/core`; the UI never parses files itself; all I/O goes through `HostApi`.
- Use refs for state read by the hotkey listener and the rAF loop (no stale closures).
- The product name comes only from `brand.json` / `BRAND`.
