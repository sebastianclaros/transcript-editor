#!/bin/bash
# Transcribes every input/*.mp4 into output/. Usage: VENV=/path/to/venv ./run.sh
# VENV defaults to ./venv. HF_TOKEN may be exported or set in a local .env (never committed).
cd "$(dirname "$0")"
shopt -s nullglob
[ -f .env ] && set -a && . ./.env && set +a
PY="${VENV:-./venv}/bin/python"
if [ ! -x "$PY" ]; then
    echo "Python venv not found at ${VENV:-./venv}. See README.md." >&2
    exit 1
fi
for f in input/*.mp4; do
    "$PY" transcribir.py "$f" --model turbo --outdir output
done
