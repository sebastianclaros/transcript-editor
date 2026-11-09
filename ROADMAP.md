# Roadmap

The roadmap lives in GitHub issues grouped by milestone; this file mirrors it.
Each item links to its Kiro spec in `.kiro/specs/`.

## v0.1 MVP desktop (local): implemented in this repository

Open a session folder, player, transcript editing, states, speakers, project file, minimap, stats,
raw transcripts, local memory, i18n es/en, packaging for Windows/macOS/Linux, E2E tests.
Open tasks: first release checklist, CI-verified E2E run, asar integrity fuse, macOS floor check.
Specs: `packaging-and-releases`, `hotkeys-and-player`.

## v0.2 Settings, i18n polish and export

- Settings screen (language, auto-scroll, theme), light theme.
- Export to txt / docx / srt (`plugin-or-export-api`).
- Accessibility audit of player and dialogs.
- Format override in the file mapping dialog.
- Kiro hooks for lint / test.

## v0.3 Drive: bring your own connection

- Guidance for the mounted _Google Drive for desktop_ folder (works today as a local folder).
- BYO Client ID mode, build-time `GOOGLE_CLIENT_ID`, desktop OAuth with loopback + PKCE,
  scope decision (`drive.file` vs `drive`), refresh token in `safeStorage`, root folder chosen at connect time.
  Specs: `google-drive-connection`, `byo-and-build-time-client-id`.

## v0.4 Local-first sync

- Sync manifest in userData, incremental `changes.list`, side-by-side conflict dialog, offline queue
  and "pending upload" state. Spec: `drive-local-first-sync`.

## v1.0 Signed releases and auto-update

- macOS signing and notarization, Windows signing, auto-update download mode
  (`signing-and-auto-update`), merging multiple audios in the app (`merge-multiple-audios`).

## Future

- Cloud / web edition (`cloud-web-edition`), in-app speaker diarization (`speaker-diarization-in-app`),
  multiple sub-folders per project.

Process: [`.kiro/steering/roadmap-process.md`](.kiro/steering/roadmap-process.md).
