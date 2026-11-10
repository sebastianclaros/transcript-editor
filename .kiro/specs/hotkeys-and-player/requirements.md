# Requirements: Hotkeys and player

Status: implemented in v0.1. Acceptance criteria use EARS.

1. THE SYSTEM SHALL provide rewind 5 s, play/pause, forward 5 s, previous and next paragraph, a seek slider and speed steps x0.75, x1, x1.5 and x2.
2. WHEN the speed is changed THE SYSTEM SHALL keep pitch and re-apply the speed after every source change.
3. WHEN Ctrl (Cmd on macOS) plus a mapped key is pressed THE SYSTEM SHALL run the action matched by physical key code in the capture phase.
4. WHEN Ctrl+Alt (AltGr) is pressed THE SYSTEM SHALL ignore the event.
5. WHEN a key is held THE SYSTEM SHALL repeat only the 5 s nudges.
6. WHEN a hotkey acts THE SYSTEM SHALL show a toast for 1.4 s.
7. WHEN the Help icon is pressed THE SYSTEM SHALL show state colours and the hotkey table with Ctrl or Cmd according to the platform.
