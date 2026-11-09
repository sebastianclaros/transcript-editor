# Google Drive: design (not implemented in v0.1)

v0.1 has **no Google API code**. This document fixes the design so the work can start without re-deciding.
Specs: `.kiro/specs/google-drive-connection`, `drive-local-first-sync`, `byo-and-build-time-client-id`.
Background: [ADR 0005](decisions/0005-drive-strategy.md).

## Works today: a mounted folder

Install _Google Drive for desktop_ and open the synced folder (`entrevistado/sesion`) like any other
session folder. Mark it "available offline" so the video is local. Limits: no checksum/revision access,
Drive creates "(1)" copies on conflict, and streaming mode may fetch a large video on demand. The app's
version check (`mtime:size`) turns an outside change into the "file changed on disk" dialog.

## Phases

1. Mounted folder guidance (docs only).
2. **Bring your own Client ID**: the user pastes their own OAuth client in settings (advanced mode).
3. Shared **Desktop** OAuth client baked in at build time, with `drive.file` or `drive` (decision below).
4. Local-first sync with a manifest.

## Client ID versus root folder

- `GOOGLE_CLIENT_ID` is a **build-time environment variable** (`.env.example`, a GitHub Actions variable,
  forks use their own). It is public by nature for a Desktop client, but it is not stored in `config.json`.
- `rootFolderId` is **user configuration** chosen when connecting to Drive and stored in `config.json`
  (`drive.rootFolderId`, already reserved and not settable from the renderer yet).
- `config.json` stays the local settings file and is never synced.

## OAuth

Desktop client type, authorization code flow with **PKCE**, system browser, redirect to a loopback
`http://127.0.0.1:<random port>`. Desktop apps are public clients and cannot keep a secret; the client secret
is optional in the token exchange and must not be relied on. The refresh token is stored with Electron
`safeStorage` (keychain / DPAPI / libsecret), never in plain JSON, and only the main process touches it.

Scopes (to decide when implementing; verify against current Google documentation):

| Scope        | Class         | Trade-off                                                                                                                                                                            |
| ------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `drive.file` | non-sensitive | simple verification; only files the app creates or the user opens with it; picking a folder may not expose its children, so the user picks files and the app creates its own outputs |
| `drive`      | restricted    | sees the whole `entrevistado/sesion` tree; needs restricted-scope verification and possibly an annual assessment (unclear for a purely local app)                                    |

Testing-mode projects have a 100-user cap and refresh tokens that expire after 7 days.

## Local-first sync

Everything works from a local copy; the cloud is a replica.

- Location: `userData/sync/<accountId>/manifest.json` and `.../cache/<driveFileId>/<file>`; only the main
  process writes there.
- Manifest entry per file: `driveId`, `parentDriveId`, `remote` (`md5Checksum`, `modifiedTime`, `headRevisionId`,
  `size`), `local` (`path`, `sha256`, `mtimeMs`), `base` (last version equal on both sides), `state`
  (`synced | local-dirty | remote-dirty | conflict | uploading | error`), plus a `changes.list` page token.
- Detection: local hash vs `base.localSha256`; remote through `changes.list` (never list the whole folder).
  Nothing changed: synced. Only local: upload. Only remote: download. Both: **conflict**.
- Upload re-reads the remote metadata right before updating and compares with `base` (no ETag precondition is
  assumed).
- **Conflict policy: ask the user.** Keep the local file untouched, put the remote version in the cache, mark
  `conflict` and show a side-by-side choice. Per-paragraph merge of the meta file is possible because paragraphs
  are independent keys. The video is never edited: remote to local only.
- Robustness: persisted operation queue, retries with exponential backoff on 403/429/5xx, atomic downloads
  (`.part` + rename), checksum check after download, offline mode with a "pending upload" badge.
- The editor also keeps saving locally first, then uploads the JSON files "just in case".

## Not decided here

Which scope ships by default, and whether to pursue verification of the shared client. Both need a Google Cloud
project owned by the maintainer: create a **Desktop app** OAuth client, enable the Drive API, set the consent
screen, add test users, and put the Client ID in the `GOOGLE_CLIENT_ID` variable.
