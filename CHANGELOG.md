# Changelog

All notable changes are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-11-10

First public version: local desktop MVP.

### Added

- Electron desktop app (Windows, macOS Intel and Apple Silicon, Linux) with a fixed top bar player
  (rewind, play/pause, forward, previous/next paragraph, seek, speed x0.75 to x2).
- Transcript editing with paragraph states, speaker names, initials and colours, and hotkeys
  (Ctrl, Cmd on macOS) with a Shift alternative.
- Sidebar with project panel, two-lane progress map and per-speaker statistics.
- Session folders with `proyecto.json`; dialogs to create it and to map audio, text and meta files.
- Raw transcript (`[HH:MM:SS] SPEAKER: text`) support, saving to a clean edited copy.
- Local memory: recent projects, last position, speed, window and sidebar state.
- Spanish and English interface.
- Optional transcription pipeline in `tools/transcribe`.
- Security hardening: context isolation, sandbox, validated IPC, path authorization,
  `app-media://` range protocol, Content-Security-Policy, Electron Fuses.

### Fixed

- Windows: path containment uses win32 rules (drive-letter case, separators, extended-length prefix)
  and CI runs green on Windows, macOS and Linux (#37).

[Unreleased]: https://github.com/sebastianclaros/transcript-editor/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/sebastianclaros/transcript-editor/releases/tag/v0.1.0
