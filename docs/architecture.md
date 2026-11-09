# Architecture

Transcript Editor is an npm-workspaces monorepo. The renderer is a React app that talks to the outside world
only through an injected `HostApi`; Electron implements that interface with IPC.

```
packages/core      pure TypeScript + zod: parsers, estados, speakers, stats, minimap, schemas, hotkeys, i18n
packages/storage   HostApi + StorageProvider contracts, LocalFsProvider, Drive stub, in-memory test host
packages/ui        React 18 components and hooks (player, transcript, sidebar, dialogs, open flow)
apps/desktop       Electron main + preload + renderer entry, electron-builder, E2E
apps/web           placeholder for the future cloud edition
tools/transcribe   optional Python pipeline
```

Dependency direction: `core <- storage <- ui <- apps/desktop`. `core` and `storage` must not import React,
Electron or Node; `ui` must not import Electron or Node and never calls `fetch`. This is enforced twice:
ESLint `no-restricted-imports` and `scripts/check-boundaries.mjs` (`npm run lint`). Internal packages ship
TypeScript source (no per-package build); Vite bundles them.

## One place for the name

`brand.json` holds the product name, app id, repository and protocol names. TypeScript reads it through
`BRAND` (`packages/core/src/brand.ts`), electron-builder through `require`.

## HostApi and storage

`packages/storage/src/host.ts` defines `HostApi`: app info, settings, recents, project (pick/open/list/read/write/
exists/mediaUrl), session memory, external links, updates, lifecycle. Every method returns a `Result` and never
throws across the boundary. The renderer never holds absolute paths as capabilities: it gets an opaque
`projectId` and passes `(projectId, fileName)`. File names are flat.

`StorageProvider` (`LocalFsProvider` over `HostApi`) is what the UI uses to open projects. A Drive provider can
plug in later (`drive/stub.ts` pins the shape). `createMemoryHost` is an in-memory `HostApi` for tests.

Versions are strings compared for equality: local `mtimeMs:size`. `writeText(..., { ifVersion })` returns
`conflict` if the file changed or was deleted; omitting `ifVersion` overwrites ("Sobrescribir").

## Core invariants

- **Paragraph count never changes** after a transcript is loaded: only `applyEdit`, `setEstado`, `cycleEstado`,
  `markRead`, `markVerified` produce new arrays and all `map`. `serializeClean` never emits an empty line.
  Property tests (fast-check) cover both entry paths (raw and clean).
- `lineAt` is a forward scan (not a binary search) to keep prototype behaviour with non-monotonic times.
- Estado transitions: playback entering a paragraph only upgrades `pendiente -> leido`; seeking while paused
  highlights without changing estado; an accepted edit goes to `corregido`; `Mod+Enter` verifies.

## UI

`App` loads settings and chooses the screen from a pure reducer (`project/openFlow.ts`): welcome, picking,
resolving, askCreate, projectDamaged, jsonView, mapping, loading, ready, failed. Effects run in
`useOpenFlow`. `Editor` owns the document state, mirrored in refs (`paragraphsRef`, `activeIdRef`, ...) so the
single hotkey listener and the single `requestAnimationFrame` loop never see stale closures. The transport,
minimap and stats own their media listeners so playback does not re-render the paragraph list (`Line` is memoized).
Auto-scroll happens only when the active paragraph id changes.

## Desktop

```
renderer (sandboxed, CSP)  --window.host-->  preload (contextBridge, ipcRenderer.invoke only)
                                                |
                                         main: ipc/register.ts  -> sender check -> zod -> host/service.ts
                                                |                                          |
                                         registry (windows, projects)       fs/authorize, fs/atomic, stores
```

- **Security**: `contextIsolation`, `sandbox`, `nodeIntegration` off, `webSecurity`, no webview, navigation and
  `window.open` blocked, permissions denied, renderer requests limited to `app:`, `app-media:`, `data:`, `blob:`,
  CSP as a response header, Electron Fuses in `afterPack`. See [ADR 0006](decisions/0006-security-model.md).
- **IPC**: one invoke channel per method (`src/shared/channels.ts`), payloads validated by zod
  (`src/shared/schemas.ts`), sender must be the main frame of a registered window at `app://renderer`.
- **Paths**: `authorizeRoot` (realpath, directory, not a filesystem root, not overlapping userData/logs) and
  `resolveInProject` (flat valid name, extension allow-list per mode, realpath containment, no symlink writes).
- **Persistence**: `config.json` (local settings) and `state.json` (per-project memory keyed by a hash of the
  project path) in userData, written atomically with a `.bak` on corruption. Never inside a project folder.
- **Media**: `app-media://media/<projectId>/<name>` served by a hand-written HTTP Range handler
  ([ADR 0007](decisions/0007-media-protocol.md)).
- **Close protocol**: main asks the renderer before closing; a dirty renderer shows the unsaved-changes dialog;
  a 10 s timer (stopped while a dialog is open) and renderer-crash detection prevent a stuck window.

## Testing

Vitest projects: `core` (node, coverage gate lines 90 / branches 85), `storage`, `ui` (jsdom with a fake media
element), `desktop` (node, real temp directories), `scripts`. Playwright drives the real Electron app
(`npm run test:e2e`): open, seeking (bug 38749), playback, hotkeys, save and restore, security checks, single instance.

Decisions are recorded in [docs/decisions](decisions/).
