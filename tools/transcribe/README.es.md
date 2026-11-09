# tools/transcribe

Pipeline opcional en Python que genera los archivos que abre el editor. La app Electron **no**
lo necesita: usalo solo si partís de grabaciones crudas.

1. `run.sh` transcribe cada `input/*.mp4` con Whisper y separa hablantes con pyannote
   (`transcribir.py`). Salida: `output/<nombre>_hablantes.txt` con líneas `[00:01:10] SPEAKER_01: texto`.
2. `unir.sh` une varias partes en una sola sesión.

El editor también abre directamente los `*_hablantes.txt` crudos (deriva párrafos y tiempos y guarda
una copia editada al lado), así que `unir.sh` solo hace falta para grabaciones en varias partes.

## Preparación

```bash
python3 -m venv venv && ./venv/bin/pip install -r requirements.txt
cp .env.example .env        # opcional: HF_TOKEN=... (nunca lo subas al repo)
mkdir -p input output        # poné los videos en input/
VENV=./venv ./run.sh
```

Necesita `ffmpeg` (y `ffprobe` para `unir.sh`). El token se lee de `HF_TOKEN` o de `--token`;
el modelo por defecto es un espejo sin restricciones, así que normalmente no hace falta.

## Unir partes (`unir.sh`)

Empareja `output/*.txt` con `input/*.mp4` uno a uno (orden `sort -V`), suma la duración de los videos
anteriores como desfase de los tiempos y escribe `unido.txt`, `unido.meta.json` y `unido.mp4`.

```bash
./unir.sh                          # deja SPEAKER_00 / SPEAKER_01
./unir.sh Lucia Mateo charla.txt   # renombra a los dos hablantes y cambia el nombre de salida
```

Después abrí la carpeta en el editor: detecta `unido.mp4`, `unido.txt` y `unido.meta.json`.
