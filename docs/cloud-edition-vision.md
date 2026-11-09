# Cloud edition: vision

A hosted web version would let people use the editor without installing anything. Nothing of it exists in
v0.1; `apps/web` is only a placeholder. Spec: `.kiro/specs/cloud-web-edition`.

## What is already shared

`packages/core` (all rules), `packages/ui` (all screens) and `packages/storage` (contracts) have no Electron or
Node dependency. A web app would provide:

- a `HostApi` implemented with `fetch` / File System Access API / a backend instead of IPC,
- a `StorageProvider` for cloud projects (Drive or an object store),
- media served with HTTP Range by the backend or by signed URLs.

`HostApi` methods that make no sense on the web return `unsupported` (open sample, updates, recents) and the
UI hides those controls.

## Open questions

- Accounts, sharing and permissions; where audio and transcripts are stored and for how long.
- Privacy and consent for sensitive interviews: the local-first, no-telemetry promise of the desktop app must
  be explicit and separate from any hosted offering.
- License implications of a hosted edition (see [ADR 0003](decisions/0003-license.md)).
- Real-time collaboration versus the per-paragraph conflict model in [drive-sync-design.md](drive-sync-design.md).
