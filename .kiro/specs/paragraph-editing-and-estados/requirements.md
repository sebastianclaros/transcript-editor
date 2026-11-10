# Requirements: Paragraph editing and estados

Status: implemented in v0.1. Acceptance criteria use EARS.

1. WHEN playback enters a paragraph in estado pendiente THE SYSTEM SHALL mark it leido and never downgrade another estado.
2. WHEN the user edits a paragraph and the text changes THE SYSTEM SHALL set it to corregido.
3. WHEN the edited text is empty THE SYSTEM SHALL restore the previous text.
4. WHEN line breaks are entered or pasted THE SYSTEM SHALL turn them into spaces.
5. WHEN the time cell is double-clicked THE SYSTEM SHALL cycle the estado.
6. WHEN Mod+Enter is pressed THE SYSTEM SHALL mark the active paragraph (or the one at the playhead) verificado.
7. THE SYSTEM SHALL never change the number or order of paragraphs of a loaded transcript.
