# Project file format

Each session folder may contain `proyecto.json` (schema version 1). Everything is validated with zod
(`packages/core/src/project.ts`); missing or extra fields are tolerated and **unknown keys are preserved** when
the file is saved.

```json
{
  "version": 1,
  "titulo": "Community garden interview",
  "descripcion": "Free text",
  "archivos": {
    "audio": "unido.mp4",
    "texto": "unido.txt",
    "meta": "unido.meta.json",
    "crudo": "original-raw.txt"
  },
  "speakers": [
    { "id": "SPEAKER_00", "nombre": "Full Name", "iniciales": "FN", "color": "#7fd1ff" }
  ],
  "visualizacion": { "mostrar": "nombre", "colorearTexto": true }
}
```

| Field                              | Meaning                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| `version`                          | schema version; a newer number is kept and a warning shown                           |
| `archivos.audio`, `archivos.texto` | required to open the session; flat file names inside the folder                      |
| `archivos.meta`                    | optional; if the file is missing the app uses defaults and warns about missing times |
| `archivos.crudo`                   | the original raw transcript when `texto` was derived from it (never overwritten)     |
| `speakers[].id`                    | the label exactly as it appears in the text (`SPEAKER_00`, `Ana`, `?`)               |
| `speakers[].nombre`, `iniciales`   | full name and initials; `color` is `#rrggbb` or `null`                               |
| `visualizacion.mostrar`            | `etiqueta`, `iniciales`, `nombre`; absent = automatic (name if set, else label)      |
| `visualizacion.colorearTexto`      | colour the paragraph text with the speaker colour                                    |

File names must be flat (no `/`, `\`, `..`, control characters, reserved Windows names, leading dot);
invalid references are dropped with a warning, so a project file can never point outside its folder.
Invalid or duplicate speaker rows are dropped individually.

## Text file

One paragraph per line: `Label: text`. The label is at most 40 characters and contains no colon. A line
with no label is a paragraph with no speaker. Blank lines are ignored, `\r\n` and a BOM are accepted.

## Meta file

A JSON array, same length and order as the text lines:
`[{ "seconds": 12.5, "speaker": "SPEAKER_00", "estado": "pendiente" }]`.
`seconds` is the start time (`-1` = unknown), `estado` is `pendiente`, `leido`, `corregido` or `verificado`.
A shorter or longer array is padded or ignored with a warning.

## Raw transcript

Lines such as `[HH:MM:SS] SPEAKER_01: text` (hours may have more than two digits). Blank lines are skipped;
lines with only a stamp are dropped (with a notice); lines without a stamp keep `seconds = -1`. The first save
writes `<base>.editado.txt` and `<base>.meta.json` (`-2`, `-3`... if taken) and records them in `archivos`.

## Backups and quirks

- A damaged `proyecto.json` is copied byte for byte to `proyecto.bak.json` (`.bak-2.json`... up to 20) before a
  new one is created.
- The paragraph count never changes in a session. Quirks kept for parity with the prototype: an unlabeled
  paragraph whose meta has a speaker gains a label on the next save; an unlabeled paragraph whose text starts
  with `Word:` is read as speaker `Word` on reload; whitespace after `Label:` is not preserved. Speakers read
  from meta that contain `:`, line breaks or exceed 40 characters are rewritten (`:` becomes `∶`) so they
  round-trip, with a notice.
- Writes are atomic (temp file + rename) and use a version check (`mtime:size`) to detect outside changes.
