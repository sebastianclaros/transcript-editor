# Requirements: Local storage and memory

Status: implemented in v0.1. Acceptance criteria use EARS.

1. THE SYSTEM SHALL keep machine settings in `config.json` and per-project memory in `state.json`, both in userData and never in a project folder.
2. WHEN a settings or state file is corrupt THE SYSTEM SHALL save it as `.bak`, recreate defaults and tell the user once.
3. WHEN a file has a newer version or unknown keys THE SYSTEM SHALL preserve them on rewrite.
4. WHEN the app starts THE SYSTEM SHALL restore the last project, the playback position, the speed and the sidebar state.
5. WHEN the last project folder no longer exists THE SYSTEM SHALL tell the user and remove it from the recents.
6. THE SYSTEM SHALL write files atomically and keep at most 10 recent projects.
