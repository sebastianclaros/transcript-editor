# Requirements: Bring your own and build-time Client ID

Status: future (not implemented). Acceptance criteria use EARS.

1. THE SYSTEM SHALL read `GOOGLE_CLIENT_ID` from the build environment, not from `config.json`.
2. WHERE a fork builds the app THE SYSTEM SHALL use the fork's own Client ID.
3. WHERE no Client ID was built in THE SYSTEM SHALL let the user paste their own in advanced settings.
4. THE SYSTEM SHALL document creating a Desktop OAuth client in Google Cloud.
