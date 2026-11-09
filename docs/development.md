# Development

## Requirements

Node.js 22 (`.nvmrc`), npm 10+, ffmpeg (only to regenerate the sample audio), a display for the E2E tests.

## Commands

| Command                                                              | What it does                                                                                                                                        |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                                             | install exactly what `package-lock.json` says                                                                                                       |
| `npm run dev`                                                        | electron-vite dev server; opens the app (set `TRANSCRIPT_EDITOR_DEV_OPEN=<folder>` to skip the folder dialog; `samples/demo-session` is a good one) |
| `npm run lint`                                                       | ESLint + package boundary check                                                                                                                     |
| `npm run typecheck`                                                  | `tsc` in every workspace                                                                                                                            |
| `npm test`                                                           | Vitest (all projects) with the core coverage gate                                                                                                   |
| `npm run build`                                                      | bundles main, preload and renderer into `apps/desktop/out`                                                                                          |
| `npm run test:e2e`                                                   | Playwright against the unpackaged build (needs a display)                                                                                           |
| `npm run docs:screenshots`                                           | refresh `docs/screenshots`                                                                                                                          |
| `npm run dist:dir` / `dist:linux` / `dist:mac` / `dist:win` / `dist` | electron-builder                                                                                                                                    |
| `npm run check`                                                      | lint, typecheck, test, build, privacy scan, Kiro files, links                                                                                       |
| `npm run format` / `format:check`                                    | Prettier                                                                                                                                            |

## E2E tests

`npm run test:e2e` launches `apps/desktop/out/main/index.cjs` with a temporary user-data directory and a temporary
copy of `samples/demo-session`, so the production CSP and the `app://` protocol are exercised. The native folder
dialog is stubbed. On Linux without a desktop, run it under a virtual display:
`xvfb-run -a --server-args="-screen 0 1280x900x24" npm run test:e2e` (this is what CI does). Without any display
the script prints a skip message and exits 0. Tests end the app with `app.exit` because a dirty editor correctly
waits for a human to answer the unsaved-changes dialog.

## Conventions

- TypeScript strict, ESM sources; the main and preload bundles are CommonJS (`.cjs`) on purpose.
- All dependency versions are exact; Dependabot proposes updates; `package-lock.json` is committed.
- UI strings come from the typed dictionaries in `packages/core/src/i18n` (Spanish source, English parity is
  tested). A test fails if Spanish prose is hard-coded in `packages/ui/src`.
- Invented data only; `npm run check:privacy` scans files and history (allow-list in `scripts/privacy-allow.json`).
- Conventional commits; sign off with `git commit -s`.

## Sample data

`samples/demo-session` (invented text, generated tone). Regenerate the audio with `scripts/make-sample.sh`.

## Known limitations of the development environment this was built in

See `docs/releasing.md` for what was not verified (macOS and Windows builds, signing, CI runs).
