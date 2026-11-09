# 0002. electron-vite, electron-builder and pinned versions

Status: accepted

## Context

We want a build and release flow like draw.io's (electron-builder, release by tag) with a modern bundler.

## Decision

- Electron **41.3.0**, electron-vite **4.0.1**, vite **6.4.5** for the app build, @vitejs/plugin-react 4.7.0,
  electron-builder **25.1.8**, @electron/fuses 2.1.3, electron-updater 6.8.11, electron-log 5.4.4,
  React 18.3.1, zod 3.25.76, TypeScript 5.9.3, Vitest 3.2.7, Playwright 1.65.0. Every version is exact; Dependabot
  proposes bumps. Newer majors exist (TypeScript 7, Vitest 5, electron-builder 26) and are not adopted yet.
- Main and preload are emitted as **CommonJS** (`out/main/index.cjs`, `out/preload/index.cjs`): sandboxed preloads
  cannot be ESM and a CJS main keeps `__dirname` and the CJS-only `electron-updater` import simple.
- Root `package.json` holds the release version; `extraMetadata.version` copies it into the app.
- Targets: macOS dmg + zip for x64 and arm64 (the Intel build serves a 2017 MacBook Air), Windows NSIS x64 + zip,
  Linux AppImage + deb x64. Unsigned; unsigned macOS builds are ad-hoc signed.
- Fuses: RunAsNode, NODE_OPTIONS and inspect arguments off, cookie encryption on, only load from asar,
  file protocol privileges off. Asar integrity validation stays **off** until verified on packaged macOS/Windows.
- Vitest uses `projects` in `vitest.config.ts` (the `vitest.workspace.ts` file is deprecated).
- **macOS floor**: Electron 41 still supports macOS 12 (documented: macOS 13 becomes required with Electron 44).
  Re-check before every Electron upgrade.

## Consequences

Playwright cannot attach to a fused build, so E2E runs on the unpackaged `out/` build and the packaged app gets a
`--smoke-test` instead. Changing the electron-vite major means rewriting `externalizeDepsPlugin` in the config.
