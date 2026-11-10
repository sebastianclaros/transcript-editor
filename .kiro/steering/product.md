---
inclusion: always
---

# Product

**Transcript Editor** is a local-first desktop app (Electron) to correct interview transcripts while listening to
the audio. Public open source, Apache-2.0, repo `sebastianclaros/transcript-editor`.

## Who and why

The prototype was one HTML file plus a Python server and Google Drive. The product replaces it with an installable
app (also for an Intel MacBook Air 2017), modelled on draw.io desktop: electron-builder, release by tag, open source hygiene.

## v0.1 scope (done)

Open a session folder; fixed top bar with the player (rewind, play/pause, forward, prev/next paragraph, seek, speed
x0.75/1/1.5/2); transcript with estados (pendiente, leido, corregido, verificado); speakers with name, initials and
colour; sidebar with project panel, two-lane minimap and per-speaker stats; Help dialog; hotkeys with Ctrl/Cmd;
`proyecto.json` per folder; raw `[HH:MM:SS]` transcripts; local memory in userData; Spanish and English UI.

## Not in v0.1

Google Drive (designed in `docs/drive-sync-design.md`), signing and auto-update, merging audios in the app, export,
cloud edition.

## Principles

- Local-first and private: no telemetry, no accounts. Never add real audio, transcripts or names to the repo.
- Never change the paragraph count of a loaded transcript.
- UI text Spanish (default) and English; code, identifiers, commits and the main README in English.
- The roadmap lives in GitHub issues and `ROADMAP.md`; each item has a spec in `.kiro/specs/`.
