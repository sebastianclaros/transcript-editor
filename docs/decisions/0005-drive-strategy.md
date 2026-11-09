# 0005. Google Drive strategy

Status: accepted (design only; no code in v0.1)

## Context

The author's workflow keeps sessions in Google Drive as `entrevistado/sesion`. Options: each user brings a Client ID;
a shared Desktop client with `drive.file` or restricted `drive`; or no API at all (mounted folder).

## Decision

Phase it: first the mounted-folder guidance (works today), then BYO Client ID, then a shared Desktop client
(loopback + PKCE, refresh token in `safeStorage`), then local-first sync with a manifest and an ask-the-user conflict
policy. `GOOGLE_CLIENT_ID` is a build-time environment variable; `rootFolderId` is user configuration chosen when
connecting and stored in `config.json`. A `StorageProvider` interface and a stub exist now so the work plugs in later.

## Consequences

No OAuth review or Google verification is needed for v0.1. The `drive.file` versus `drive` question stays open.
Details: [drive-sync-design.md](../drive-sync-design.md).
