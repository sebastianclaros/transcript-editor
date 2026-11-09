# 0007. Media through a custom protocol with manual Range

Status: accepted

## Context

Chromium needs HTTP Range support to seek. Electron's `net.fetch(file://)` handling breaks seeking
(Electron issue 38749), which is what the prototype's Python server worked around.

## Decision

`protocol.handle("app-media")` with a hand-written handler: URL `app-media://media/<projectId>/<name>`
(fixed host; the 128-bit id is in the path because Chromium canonicalizes the host of standard schemes and a random
hex host could be read as an IPv4 number). It answers 200, 206 with `Content-Range`, 416, and HEAD, streams with
`createReadStream({ start, end })`, resolves the file through the same path authorization as the rest, and treats the
unguessable project id as the capability (the Referer check is defence in depth only).

## Consequences

Seeking was verified in real Chromium inside Electron 41 (E2E: `currentTime` sticks, `seekable` is not empty,
the handler counted 206 responses). If a future Electron breaks this, the documented fallback is a loopback HTTP
server on `127.0.0.1:0` with an ephemeral token; only `media/server.ts` would change.
