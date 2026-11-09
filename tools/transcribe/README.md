# tools/transcribe

Optional Python pipeline that produces the files the editor opens. The Electron app does **not**
need it: use it only if you start from raw recordings.

1. `run.sh` transcribes every `input/*.mp4` with Whisper and separates speakers with pyannote
   (`transcribir.py`). Output: `output/<name>_hablantes.txt` with lines like
   `[00:01:10] SPEAKER_01: text`, one block per speaker turn, separated by blank lines.
2. `unir.sh` merges several parts into one session (see below).

The editor can open the raw `*_hablantes.txt` files directly (it derives paragraphs and times and
saves an edited copy next to it), so step 2 is only needed for multi-part recordings.

## Setup

```bash
python3 -m venv venv && ./venv/bin/pip install -r requirements.txt
cp .env.example .env        # optional: HF_TOKEN=... (never commit it)
mkdir -p input output        # put the videos in input/
VENV=./venv ./run.sh
```

Requires `ffmpeg` (and `ffprobe` for `unir.sh`) on the PATH. `HF_TOKEN` is read from the
environment or `--token`; the default model is a non-gated mirror, so a token is usually not needed.

## Merging parts (`unir.sh`)

Pairs `output/*.txt` with `input/*.mp4` one to one (both sorted with `sort -V`), adds the duration
of the previous videos (via `ffprobe`) as an offset to every time stamp, and writes:

| File              | Content                                                             |
| ----------------- | ------------------------------------------------------------------- |
| `unido.txt`       | clean text, one `Speaker: text` line per paragraph                  |
| `unido.meta.json` | `[{ "seconds", "speaker", "estado" }]` aligned by line              |
| `unido.mp4`       | all videos concatenated (copy, or re-encoded if the formats differ) |

```bash
./unir.sh                      # keeps SPEAKER_00 / SPEAKER_01
./unir.sh Lucia Mateo charla.txt   # renames the two speakers, custom output name
```

Then open the folder in the editor: it detects `unido.mp4`, `unido.txt` and `unido.meta.json`.
If the number of texts and videos differ, times are not accumulated (a warning is printed).
