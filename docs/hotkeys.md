# Hotkeys

`Mod` is `Ctrl` on Windows and Linux and `Cmd` on macOS (either key works on any system). Keys are matched
by physical key code in the capture phase, so they work on any keyboard layout and even while a paragraph
is being edited. AltGr (Ctrl+Alt) is ignored because it types characters. The table is defined once in
`packages/core/src/hotkeys.ts` and rendered by the Help dialog.

| Action                                                                          | Primary     | Alternative       | Repeats when held |
| ------------------------------------------------------------------------------- | ----------- | ----------------- | ----------------- |
| Save                                                                            | `Mod+S`     |                   | no                |
| Play / pause                                                                    | `Mod+Space` | `Mod+Shift+Space` | no                |
| Back 5 s                                                                        | `Mod+←`     | `Mod+Shift+←`     | yes               |
| Forward 5 s                                                                     | `Mod+→`     | `Mod+Shift+→`     | yes               |
| Start of paragraph (previous one if within 1.2 s of the start; scaled by speed) | `Mod+↑`     | `Mod+Shift+↑`     | no                |
| Next paragraph                                                                  | `Mod+↓`     | `Mod+Shift+↓`     | no                |
| Start of audio                                                                  | `Mod+Home`  | `Mod+Shift+Home`  | no                |
| Mark verified (active paragraph, or the one at the playhead)                    | `Mod+Enter` | `Mod+Shift+Enter` | no                |
| Slower                                                                          |             | `Mod+Shift+,`     | no                |
| Faster                                                                          |             | `Mod+Shift+.`     | no                |

Notes:

- Paragraph navigation (start, next, minimap, clicking a time) **starts playback**; ±5 s, start of audio and the
  seek slider only move the playhead.
- The system may reserve some primaries: `Ctrl+Space` and `Ctrl+arrows` on many Linux desktops, `Cmd+Space`
  (Spotlight) and `Ctrl+arrows` (Mission Control) on macOS. Use the Shift alternatives there.
- Ordinary shortcuts (`Ctrl+C`, `Ctrl+V`, `Ctrl+Z`, `Ctrl+A`) are never intercepted.
- `F1` opens the Help dialog; `Ctrl/Cmd+O` opens a folder (menu).
