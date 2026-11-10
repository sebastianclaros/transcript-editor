# Requirements: Transcript playback

Status: implemented in v0.1. Acceptance criteria use EARS.

1. WHEN a project is loaded THE SYSTEM SHALL show one row per paragraph with its time, speaker and text.
2. WHEN the audio plays THE SYSTEM SHALL highlight and enlarge the paragraph whose start time is the latest one not after the playhead.
3. WHEN the active paragraph id changes THE SYSTEM SHALL scroll it to the centre, and ONLY then, if auto-scroll is enabled.
4. WHEN the user clicks a paragraph time THE SYSTEM SHALL seek there and start playback.
5. WHEN the audio is seeked while paused THE SYSTEM SHALL highlight the paragraph without changing any estado.
6. IF the audio cannot be played THEN THE SYSTEM SHALL show a banner and keep editing available.
7. THE SYSTEM SHALL serve audio with HTTP Range so that seeking works.
