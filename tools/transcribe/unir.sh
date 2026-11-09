#!/bin/bash
#
# Une las transcripciones de output/ y los videos de input/ para el editor.
#
# Genera 3 archivos:
#   - unido.txt        Texto limpio (una linea por parrafo: "Nombre: texto").
#                      SIN tiempos: los tiempos viven en el .meta.json.
#   - unido.meta.json  Metadata por parrafo: tiempo absoluto (seconds),
#                      hablante (speaker) y estado ("pendiente"). Este archivo
#                      permite sincronizar el audio aunque el .txt no muestre
#                      los tiempos, y guarda el estado de verificacion.
#   - unido.mp4        Todos los videos de input/ unidos en uno.
#
# Los textos (output/*.txt) y los videos (input/*.mp4) se ordenan por nombre
# (sort -V) y se emparejan 1 a 1. El tiempo de cada parrafo es absoluto
# respecto al video unido: se acumula la duracion de los videos anteriores.
#
# Uso:
#   ./unir.sh [nombre_speaker_00] [nombre_speaker_01] [archivo_texto]
#
# Argumentos (todos opcionales):
#   $1  Nombre que reemplaza a "SPEAKER_00"  (por defecto: SPEAKER_00)
#   $2  Nombre que reemplaza a "SPEAKER_01"  (por defecto: SPEAKER_01)
#   $3  Nombre del archivo de texto de salida (por defecto: unido.txt)
#       El .meta.json usa la misma base (unido.txt -> unido.meta.json).
#
# Ejemplos:
#   ./unir.sh Lucia Mateo
#   ./unir.sh Lucia Mateo charla.txt

set -euo pipefail

DIR_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIR_OUTPUT="$DIR_SCRIPT/output"
DIR_INPUT="$DIR_SCRIPT/input"
SALIDA_VIDEO="$DIR_SCRIPT/unido.mp4"

SPK00="${1:-SPEAKER_00}"
SPK01="${2:-SPEAKER_01}"
ARCHIVO_SALIDA="${3:-unido.txt}"

# Ruta absoluta del archivo de texto
case "$ARCHIVO_SALIDA" in
    /*) SALIDA="$ARCHIVO_SALIDA" ;;
    *)  SALIDA="$DIR_SCRIPT/$ARCHIVO_SALIDA" ;;
esac
# El meta.json acompana al .txt (misma base, extension .meta.json)
SALIDA_META="${SALIDA%.txt}.meta.json"

if [ ! -d "$DIR_OUTPUT" ]; then
    echo "Error: no existe la carpeta $DIR_OUTPUT" >&2
    exit 1
fi

# Textos ordenados numericamente por nombre (3.txt, 4.txt, ... 10.txt)
mapfile -t ARCHIVOS < <(find "$DIR_OUTPUT" -maxdepth 1 -type f -name '*.txt' | sort -V)
if [ "${#ARCHIVOS[@]}" -eq 0 ]; then
    echo "Error: no se encontraron archivos .txt en $DIR_OUTPUT" >&2
    exit 1
fi

# Videos en el mismo orden (emparejan 1 a 1 con los textos)
mapfile -t VIDEOS < <(find "$DIR_INPUT" -maxdepth 1 -type f -name '*.mp4' 2>/dev/null | sort -V)

# Duracion (segundos enteros) de un video via ffprobe. Redondeo con awk para
# no depender del locale (en es_AR printf espera coma decimal y falla).
duracion_seg() {
    local archivo="$1" d
    if command -v ffprobe >/dev/null 2>&1 && [ -f "$archivo" ]; then
        d="$(ffprobe -v error -show_entries format=duration \
                -of default=noprint_wrappers=1:nokey=1 "$archivo" 2>/dev/null)"
        awk -v x="${d:-0}" 'BEGIN { printf "%d", (x + 0.5) }'
    else
        echo 0
    fi
}

# Determinar si se pueden acumular tiempos (igual cantidad de textos y videos)
usar_offset=0
if [ "${#VIDEOS[@]}" -eq "${#ARCHIVOS[@]}" ] && [ "${#VIDEOS[@]}" -gt 0 ] \
   && command -v ffprobe >/dev/null 2>&1; then
    usar_offset=1
elif [ "${#VIDEOS[@]}" -ne "${#ARCHIVOS[@]}" ] && [ "${#VIDEOS[@]}" -gt 0 ]; then
    echo "Aviso: ${#ARCHIVOS[@]} textos y ${#VIDEOS[@]} videos; sin acumular tiempos." >&2
fi

# ---------------------------------------------------------------------------
# Procesar cada parrafo: extraer tiempo (absoluto), hablante y texto limpio.
# Escribe el texto limpio en $SALIDA y la metadata en $SALIDA_META.
#
# awk recibe:
#   OFFSET   offset en segundos a sumar a los tiempos de este archivo
#   SPK00/01 nombres para reemplazar SPEAKER_00 / SPEAKER_01
#   META     ruta del archivo meta (se le hace append)
#   PRIMERO  "1" en el primer parrafo global (controla la coma del JSON)
# ---------------------------------------------------------------------------
procesar() {
    local archivo="$1" offset="$2" primero="$3"
    OFFSET="$offset" SPK00="$SPK00" SPK01="$SPK01" META="$SALIDA_META" PRIMERO="$primero" \
    awk '
    BEGIN {
        offset = ENVIRON["OFFSET"] + 0
        s00 = ENVIRON["SPK00"]; s01 = ENVIRON["SPK01"]
        meta = ENVIRON["META"]
        first = (ENVIRON["PRIMERO"] == "1")
    }
    # Omite lineas vacias
    /^[[:space:]]*$/ { next }
    {
        line = $0
        seconds = -1
        # [HH:MM:SS] al inicio -> calcula segundos absolutos y lo quita
        if (match(line, /^\[[0-9][0-9]:[0-9][0-9]:[0-9][0-9]\][[:space:]]*/)) {
            stamp = substr(line, 2, 8)
            split(stamp, p, ":")
            seconds = p[1]*3600 + p[2]*60 + p[3] + offset
            line = substr(line, RLENGTH + 1)
        }
        # Reemplazo de hablantes (SPEAKER_00 / SPEAKER_01)
        gsub(/SPEAKER_00/, s00, line)
        gsub(/SPEAKER_01/, s01, line)

        # Separar "Hablante: texto"
        speaker = ""
        if (match(line, /^[^:]+:[[:space:]]*/)) {
            speaker = substr(line, 1, RLENGTH)
            sub(/:[[:space:]]*$/, "", speaker)
            gsub(/^[[:space:]]+|[[:space:]]+$/, "", speaker)
        }

        # Linea de texto limpio
        print line

        # Linea de metadata (JSON), emparejada por posicion
        # escape minimo de comillas y backslash en speaker
        esc = speaker
        gsub(/\\/, "\\\\", esc)
        gsub(/"/, "\\\"", esc)

        sep = (first ? "" : ",\n")
        first = 0
        printf "%s    {\"seconds\": %d, \"speaker\": \"%s\", \"estado\": \"pendiente\"}", \
               sep, seconds, esc >> meta
    }
    END {
        # Propagar el flag "first" al proceso llamador via codigo de salida:
        # 10 = sigue siendo el primero (archivo sin parrafos), 0 = ya escribio
        exit (first ? 10 : 0)
    }
    ' "$archivo"
}

# Construir ambos archivos
: > "$SALIDA"
printf '[\n' > "$SALIDA_META"

offset=0
primero=1
for i in "${!ARCHIVOS[@]}"; do
    set +e
    procesar "${ARCHIVOS[$i]}" "$offset" "$primero" >> "$SALIDA"
    rc=$?
    set -e
    # Si awk escribio al menos un parrafo, ya no es el primero
    if [ "$rc" -eq 0 ]; then
        primero=0
    elif [ "$rc" -ne 10 ]; then
        echo "Error procesando ${ARCHIVOS[$i]} (codigo $rc)" >&2
        exit 1
    fi
    if [ "$usar_offset" -eq 1 ]; then
        dur="$(duracion_seg "${VIDEOS[$i]}")"
        offset=$(( offset + dur ))
    fi
done

printf '\n]\n' >> "$SALIDA_META"

echo "Texto limpio en:  $SALIDA"
echo "Metadata en:      $SALIDA_META"
echo "Parrafos:         $(grep -c '' "$SALIDA")"
echo "Textos procesados (${#ARCHIVOS[@]}):"
printf '  %s\n' "${ARCHIVOS[@]}"

# ---------------------------------------------------------------------------
# Unir los videos de input/ en un solo unido.mp4
# ---------------------------------------------------------------------------
if ! command -v ffmpeg >/dev/null 2>&1; then
    echo "Aviso: ffmpeg no esta instalado, se omite la union de videos." >&2
    exit 0
fi
if [ ! -d "$DIR_INPUT" ] || [ "${#VIDEOS[@]}" -eq 0 ]; then
    echo "Aviso: sin videos en $DIR_INPUT, se omite la union." >&2
    exit 0
fi

# Si unido.mp4 ya existe y es mas nuevo que todos los inputs, no re-unir
if [ -f "$SALIDA_VIDEO" ]; then
    mas_nuevo=1
    for v in "${VIDEOS[@]}"; do
        if [ "$v" -nt "$SALIDA_VIDEO" ]; then mas_nuevo=0; break; fi
    done
    if [ "$mas_nuevo" -eq 1 ]; then
        echo ""
        echo "Video ya actualizado: $SALIDA_VIDEO (se omite la re-union)."
        echo "   Borralo si queres forzar la union de nuevo."
        exit 0
    fi
fi

LISTA_CONCAT="$(mktemp)"
trap 'rm -f "$LISTA_CONCAT"' EXIT
for v in "${VIDEOS[@]}"; do
    printf "file '%s'\n" "${v//\'/\'\\\'\'}" >> "$LISTA_CONCAT"
done

echo ""
echo "Uniendo videos en: $SALIDA_VIDEO"
if ffmpeg -y -f concat -safe 0 -i "$LISTA_CONCAT" -c copy "$SALIDA_VIDEO" >/dev/null 2>&1; then
    echo "Videos unidos (copia directa)."
else
    echo "Los videos tienen formatos distintos; recodificando..."
    ffmpeg -y -f concat -safe 0 -i "$LISTA_CONCAT" \
        -c:v libx264 -c:a aac "$SALIDA_VIDEO" >/dev/null 2>&1
    echo "Videos unidos (recodificados)."
fi
echo "Videos procesados (${#VIDEOS[@]}):"
printf '  %s\n' "${VIDEOS[@]}"
