"""
Transcribe una entrevista con Whisper y separa hablantes con pyannote.

Uso:
    python transcribir.py entrevista.mp3 [--model turbo]

Salida: entrevista_hablantes.txt
"""
import argparse
import os
import subprocess
import tempfile

import soundfile as sf
import torch
import torchaudio

# torch >= 2.6 usa weights_only=True por defecto; los checkpoints de pyannote
# usan pickle completo (fuente confiable), así que forzamos weights_only=False
_torch_load = torch.load

def _load_full(*a, **kw):
    kw["weights_only"] = False
    return _torch_load(*a, **kw)

torch.load = _load_full

# Compatibilidad: torchaudio >= 2.9 eliminó APIs que pyannote 3.x necesita
if not hasattr(torchaudio, "list_audio_backends"):
    torchaudio.list_audio_backends = lambda: ["soundfile"]

if not hasattr(torchaudio, "AudioMetaData"):
    class _AudioMetaData:
        def __init__(self, sample_rate, num_frames, num_channels):
            self.sample_rate = sample_rate
            self.num_frames = num_frames
            self.num_channels = num_channels

    torchaudio.AudioMetaData = _AudioMetaData

if not hasattr(torchaudio, "info"):
    def _info(path, backend=None):
        i = sf.info(path)
        return torchaudio.AudioMetaData(i.samplerate, i.frames, i.channels)

    torchaudio.info = _info

    def _load(path, frame_offset=0, num_frames=-1, backend=None, **kwargs):
        data, sr = sf.read(
            path, start=frame_offset, frames=num_frames, dtype="float32", always_2d=True
        )
        return torch.from_numpy(data.T), sr

    torchaudio.load = _load

import whisper
from pyannote.audio import Pipeline

p = argparse.ArgumentParser()
p.add_argument("audio")
p.add_argument("--token", default=os.environ.get("HF_TOKEN"), help="Hugging Face token (optional; defaults to $HF_TOKEN)")
p.add_argument("--model", default="large-v3", help="tiny/base/small/medium/large-v3/turbo")
p.add_argument("--speakers", type=int, default=2)
p.add_argument("--outdir", default=None, help="Carpeta de salida (por defecto, junto al audio)")
args = p.parse_args()

# pyannote es más confiable con WAV mono 16 kHz
fd, tmp_wav = tempfile.mkstemp(prefix="diar_", suffix=".wav")  # unique name: safe for parallel runs
os.close(fd)
subprocess.run(
    ["ffmpeg", "-y", "-loglevel", "error", "-i", args.audio, "-ac", "1", "-ar", "16000", tmp_wav],
    check=True,
)

print("1/3 Separando hablantes...")
# Mirror no-gated del pipeline pyannote/speaker-diarization-3.1
DIAR_MODEL = "tensorlake/speaker-diarization-3.1"
try:
    pipe = Pipeline.from_pretrained(DIAR_MODEL, token=args.token)
except TypeError:  # versiones viejas de pyannote
    pipe = Pipeline.from_pretrained(DIAR_MODEL, use_auth_token=args.token)
diar = pipe(tmp_wav, num_speakers=args.speakers)
annotation = getattr(diar, "speaker_diarization", diar)  # compatibilidad pyannote 3 / 4
turns = [(t.start, t.end, spk) for t, _, spk in annotation.itertracks(yield_label=True)]

print("2/3 Transcribiendo con Whisper...")
model = whisper.load_model(args.model)
result = model.transcribe(args.audio, language="es")


def hablante(s, e):
    """Hablante con más superposición en el tramo [s, e]."""
    best, overlap = "?", 0.0
    for a, b, spk in turns:
        o = min(e, b) - max(s, a)
        if o > overlap:
            best, overlap = spk, o
    return best


def ts(sec):
    h, rem = divmod(int(sec), 3600)
    m, s = divmod(rem, 60)
    return f"{h:02d}:{m:02d}:{s:02d}"


print("3/3 Armando el texto...")
bloques = []
for seg in result["segments"]:
    spk = hablante(seg["start"], seg["end"])
    texto = seg["text"].strip()
    if bloques and bloques[-1][1] == spk:
        bloques[-1][2].append(texto)  # mismo hablante: se une al bloque anterior
    else:
        bloques.append([seg["start"], spk, [texto]])

base = os.path.splitext(os.path.basename(args.audio))[0] + "_hablantes.txt"
if args.outdir:
    os.makedirs(args.outdir, exist_ok=True)
    salida = os.path.join(args.outdir, base)
else:
    salida = os.path.join(os.path.dirname(args.audio), base)
with open(salida, "w", encoding="utf-8") as f:
    for start, spk, textos in bloques:
        f.write(f"[{ts(start)}] {spk}: {' '.join(textos)}\n\n")

os.remove(tmp_wav)
print(f"Listo: {salida}")
