# Requirements: Speakers and project file

Status: implemented in v0.1. Acceptance criteria use EARS.

1. THE SYSTEM SHALL read and write `proyecto.json` version 1 with title, description, archivos, speakers and visualizacion.
2. WHEN fields are missing or extra THE SYSTEM SHALL tolerate them and preserve unknown keys on save.
3. WHEN a speaker has a colour THE SYSTEM SHALL use it for the label, optionally the text, the minimap lane and the stats.
4. WHEN a file reference is not a flat valid name THE SYSTEM SHALL drop it with a warning.
5. WHEN the project panel is edited THE SYSTEM SHALL mark the project dirty and write it on the next save.
6. THE SYSTEM SHALL offer a validated raw JSON view of the project file.
