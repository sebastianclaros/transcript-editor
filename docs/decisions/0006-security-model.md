# 0006. Electron security model

Status: accepted

## Context

The app opens files chosen by the user and renders text from them. A compromised renderer must not reach the file
system or the network.

## Decision

Copy draw.io's model: context isolation, sandbox, no node integration, web security, no webview, navigation and
window opening blocked (https links validated and opened externally), permissions denied, renderer requests limited
to our own schemes, CSP as a response header, IPC with one channel per method, zod validation and sender checks
(main frame of a registered window at `app://renderer`, compared by parsed parts, not `URL.origin`). The renderer
gets opaque project ids, never paths; main authorizes folders with `realpath`, keeps writes to flat `.txt`/`.json`
names, refuses symlink escapes, and rejects folders that overlap userData. Electron Fuses harden the binary.

## Consequences

Slightly more plumbing per feature (channel + schema + service method). A security regression is caught by unit
tests (authorization, sender validation, schemas) and by the E2E security spec.
