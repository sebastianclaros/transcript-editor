# apps/web (placeholder)

Future cloud/web edition of Transcript Editor. No code yet.

The idea (see `docs/cloud-edition-vision.md`): reuse `packages/core`, `packages/storage` and
`packages/ui` unchanged, and implement `HostApi` with `fetch` / File System Access instead of
Electron IPC.
