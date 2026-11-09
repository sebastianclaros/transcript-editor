# Transcription pipeline

The optional scripts in [`tools/transcribe`](../tools/transcribe/README.md) turn recordings into the files the
editor opens. Spanish: [README.es.md](../tools/transcribe/README.es.md).

```
input/*.mp4 --run.sh/transcribir.py--> output/*_hablantes.txt  (raw: "[HH:MM:SS] SPEAKER_01: text")
output/*.txt + input/*.mp4 --unir.sh--> unido.txt + unido.meta.json + unido.mp4
```

- `transcribir.py`: ffmpeg converts to mono 16 kHz WAV, pyannote separates speakers, Whisper transcribes
  (Spanish), each segment gets the speaker with most overlap (`?` when none), consecutive segments of the same
  speaker are merged into a block. The Hugging Face token comes from `HF_TOKEN` or `--token`, never from a file in
  the repo.
- `unir.sh`: pairs transcripts and videos one to one (`sort -V`), adds the duration of previous videos as a time
  offset, optionally renames `SPEAKER_00` / `SPEAKER_01`, concatenates the videos.

The editor reads the raw format itself ([project-file.md](project-file.md)), so single-part recordings do not
need `unir.sh`. Merging several audios inside the app is a roadmap item (`merge-multiple-audios`).
