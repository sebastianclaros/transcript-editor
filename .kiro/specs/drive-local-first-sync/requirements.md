# Requirements: Drive local-first sync

Status: future (not implemented). Acceptance criteria use EARS.

1. THE SYSTEM SHALL keep a manifest per account in userData with remote and local checksums.
2. WHEN local and remote both changed THE SYSTEM SHALL show a side-by-side conflict choice and never overwrite silently.
3. WHEN offline THE SYSTEM SHALL queue uploads and show "pendiente de subir".
4. THE SYSTEM SHALL use incremental `changes.list` instead of listing folders.
5. WHEN JSON files are saved THE SYSTEM SHALL also upload them to the session folder.
