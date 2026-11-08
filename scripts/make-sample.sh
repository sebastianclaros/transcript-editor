#!/usr/bin/env bash
# Regenerates samples/demo-session/demo.m4a: ~75 s of a quiet, slowly changing tone (no speech).
# The text, meta and proyecto.json of the demo are invented and committed by hand.
# Requires ffmpeg with the native AAC encoder.
set -euo pipefail
cd "$(dirname "$0")/.."
out="samples/demo-session/demo.m4a"
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "sine=frequency=330:sample_rate=22050:duration=75" \
  -af "tremolo=f=0.4:d=0.6,volume=0.25" \
  -ac 1 -c:a aac -b:a 16k -movflags +faststart "$out"
ls -l "$out"
