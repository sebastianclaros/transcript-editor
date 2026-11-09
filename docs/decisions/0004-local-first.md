# 0004. Local-first, no telemetry

Status: accepted

## Context

Interviews are sensitive. Users should be able to trust that nothing leaves the machine.

## Decision

All files stay in the folder the user picks. The app has no telemetry, accounts or background network calls; the
only request is a user-initiated update check. App memory is in userData: `config.json` (machine settings: language,
recents, window, speed, sidebar, a reserved `drive.rootFolderId`) and `state.json` (per-project position and speed,
keyed by a hash of the project path). Nothing is written to the project folder except the text, meta and
`proyecto.json` (and `proyecto.bak*.json` backups). Files are written atomically; corrupt app files are saved as
`.bak` and recreated.

## Consequences

No sync between machines in v0.1 (see ADR 0005). `config.json` is never synced, so moving to another computer
starts with fresh settings.
