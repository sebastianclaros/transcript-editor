# Requirements: Project open flow

Status: implemented in v0.1. Acceptance criteria use EARS.

1. WHEN a folder is opened and `proyecto.json` exists THE SYSTEM SHALL use its `archivos` block.
2. WHEN `proyecto.json` is missing THE SYSTEM SHALL ask whether to create it, continue without it, or cancel.
3. WHEN the user chooses Create THE SYSTEM SHALL ask for the audio, text and meta files (pre-detected) and write nothing until the first save.
4. WHEN referenced files are missing THE SYSTEM SHALL open the mapping dialog.
5. WHEN `proyecto.json` is damaged THE SYSTEM SHALL offer to view and edit it, or to back it up as `proyecto.bak.json` and start a new one.
6. WHEN the text is a raw transcript THE SYSTEM SHALL derive paragraphs and save an edited copy without touching the original.
7. WHEN the user leaves a project with unsaved changes THE SYSTEM SHALL offer Guardar, Descartar or Cancelar.
