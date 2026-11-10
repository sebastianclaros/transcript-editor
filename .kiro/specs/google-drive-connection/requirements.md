# Requirements: Google Drive connection

Status: future (not implemented). Acceptance criteria use EARS.

1. WHEN the user chooses to connect Drive THE SYSTEM SHALL run desktop OAuth with PKCE through the system browser and a loopback redirect.
2. THE SYSTEM SHALL store the refresh token with safeStorage and never in plain JSON.
3. WHEN connecting THE SYSTEM SHALL let the user pick the root folder and store `rootFolderId` in `config.json`.
4. THE SYSTEM SHALL list `entrevistado/sesion` projects and open one as a project.
5. IF the connection fails or is offline THEN THE SYSTEM SHALL keep working with local files.
