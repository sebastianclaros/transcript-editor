# 0008. Implementation decisions taken without asking

Status: accepted

Ambiguities resolved while building v0.1 (the maintainer was away):

- `SpeakerInfo` is a `ReadonlyMap`, not a plain object, so labels such as `__proto__` or `constructor` are safe.
- The file mapping dialog does not offer a manual raw/clean format override: the format is detected
  (`detectFormat`) and the override is a v0.2 item.
- Closing a dirty editor waits for the user's answer; the 10 s timer stops while the unsaved-changes dialog is open.
- Cancelling the native folder dialog while an editor is open keeps the editor on screen.
- "Recargar" re-resolves the project from disk through the same open flow.
- Hours in raw time stamps may have two or more digits; minutes and seconds above 59 make the line unstamped.
- `Mod+Enter` with no active paragraph verifies the paragraph at the playhead (prototype behaviour); the "no active
  paragraph" toast appears only before the first timed paragraph.
- Version strings compare `mtimeMs:size`; two writes of the same size within one filesystem timestamp tick can look
  identical. This can only hide an outside change in an extreme race, never produce a false conflict.
- The sample is copied to `Documents/Transcript Editor Demo` and never overwritten.
- The window may appear briefly during `--smoke-test` and E2E runs on machines with a display.
