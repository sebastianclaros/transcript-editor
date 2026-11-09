# User guide

How to work a session with Transcript Editor. Spanish: [user-guide.es.md](user-guide.es.md).

## 1. What the folder needs

One folder per session containing an **audio or video** file (`.mp4`, `.m4a`, `.mp3`, `.wav`, `.ogg`), the
**text** (one `Label: text` line per paragraph) and, optionally, the **meta** JSON with time, speaker and state
per paragraph. A raw transcript (`[00:01:10] SPEAKER_01: text`) can be opened directly. Without times the
audio cannot follow the text.

## 2. Opening a session

1. On the start screen choose **Open session folder** (or **Open sample session**). Recent projects are listed.
2. If there is no `proyecto.json` the app asks whether to create it:
   **Create** (pick audio, text and meta; the project panel opens; the file is written on the first save) or
   **Continue without project** (default colours; create it later from the sidebar).
3. A damaged `proyecto.json` can be viewed and fixed, or ignored (a copy is kept as `proyecto.bak.json`).
4. If the project names files that no longer exist, a dialog lets you choose others.

## 3. The screen

Fixed top bar (player, speed, position, save status, auto-scroll, open, reload, save, project, help),
a collapsible sidebar (project, progress map), the paragraph list, and a footer with per-speaker statistics.

Paragraph states: grey _pending_, blue _read_ (the audio played over it), orange _corrected_ (you edited it),
green _verified_ (`Ctrl+Enter`). Double click a paragraph's time to cycle the state by hand.

## 4. Editing

- Click the text and type. Leaving the paragraph marks it _corrected_.
- A paragraph is always one line: line breaks become spaces and an empty paragraph restores its previous text,
  so text and meta never drift apart.
- Click a time to jump there and play.
- **Save** (`Ctrl+S`, `Cmd+S` on Mac) writes text, meta and, when needed, `proyecto.json`. If a file changed on
  disk you can _Overwrite_, _Reload from disk_ or _Cancel_.
- Saving a raw transcript creates a clean copy (`<name>.editado.txt`, `<name>.meta.json`) and records it in
  `proyecto.json`. The original is never modified.

## 5. Speakers and project

Use the people icon or **Edit project** to set title, description and, per speaker, full name, initials and
colour, how names are shown, and whether text takes the speaker colour. **View/edit proyecto.json** shows
the raw file with validation.

## 6. Progress map and statistics

Two lanes (state and speaker); click a segment to jump. Percent done, time remaining and verified count are
shown beside it. The footer shows words, share of text, paragraphs and estimated speaking time per speaker.

## 7. Hotkeys, language, memory

See [hotkeys.md](hotkeys.md) or the **?** button. Change the language from **?**. The app remembers the last
project, position, speed, window and sidebar in its application data folder, never in your session folders.

## 8. Troubleshooting

- Audio does not play: a red notice appears; editing still works.
- "No times": the meta is missing or has no times.
- macOS says the app is damaged or unverified: builds are unsigned, see the README install section.
