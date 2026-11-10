---
inclusion: fileMatch
fileMatchPattern: "apps/desktop/**"
---

# Electron security rules

- Keep `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`, no webview.
- The preload exposes ONE object (`window.host`) built from `ipcRenderer.invoke`; never a generic invoke.
- Every IPC channel: constant in `shared/channels.ts`, zod schema in `shared/schemas.ts`, handler in
  `ipc/register.ts`, logic in `host/service.ts`. The sender must be the main frame of a registered window at
  `app://renderer` (compare parsed URL parts, never `URL.origin` for custom schemes).
- The renderer never supplies absolute paths. Use `authorizeRoot` and `resolveInProject`: flat valid names, `.txt`/`.json`
  for text, audio extensions for media, no symlink escapes.
- Writes are atomic (temp file + rename).
- The CSP is a response header; no inline scripts or styles, no `dangerouslySetInnerHTML`.
- No telemetry, no remote content, no new network calls without an ADR.
- Media goes through `app-media://media/<projectId>/<name>` with the Range handler.
- Closing goes through `CloseProtocol` (never `win.destroy()` on dirty state).
