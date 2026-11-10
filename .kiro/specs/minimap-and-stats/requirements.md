# Requirements: Minimap and stats

Status: implemented in v0.1. Acceptance criteria use EARS.

1. THE SYSTEM SHALL show a two-lane map (estado and speaker) with the playhead.
2. WHEN every paragraph has a time and the duration is known THE SYSTEM SHALL size segments proportionally to the audio, otherwise in equal slices.
3. WHEN a segment is clicked THE SYSTEM SHALL seek to that paragraph.
4. THE SYSTEM SHALL show percent done, remaining time, paragraph n of N, counts per estado and the verified count.
5. THE SYSTEM SHALL show per speaker words, share of text, paragraphs and estimated speaking time with a stacked bar and totals.
6. WHEN counting words THE SYSTEM SHALL count whitespace tokens that contain a letter or digit.
