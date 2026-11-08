import { validateFileName } from "./files";
import {
  isEstado,
  type Paragraph,
  type ParagraphMeta,
  type ParsedTranscript,
  type ParseWarning,
  type TranscriptFormat,
} from "./paragraphs";
import { sanitizeSpeaker, splitLabel } from "./text";

export class InvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvariantError";
  }
}

const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Reads the text of a meta file. `null` means the file does not exist. */
export function readMeta(jsonText: string | null): { meta: unknown; warnings: ParseWarning[] } {
  if (jsonText === null) return { meta: undefined, warnings: [{ code: "meta_missing" }] };
  try {
    const meta: unknown = JSON.parse(stripBom(jsonText));
    return { meta, warnings: [] };
  } catch {
    return { meta: undefined, warnings: [{ code: "meta_invalid_json" }] };
  }
}

function timingWarnings(paragraphs: Paragraph[]): ParseWarning[] {
  const out: ParseWarning[] = [];
  if (paragraphs.length === 0) return out;
  let anyTimed = false;
  let prev = -1;
  let nonMono = -1;
  paragraphs.forEach((p, i) => {
    if (p.seconds < 0) return;
    anyTimed = true;
    if (prev >= 0 && p.seconds < prev && nonMono < 0) nonMono = i;
    prev = Math.max(prev, p.seconds);
  });
  if (!anyTimed) out.push({ code: "no_times" });
  if (nonMono >= 0) out.push({ code: "non_monotonic_times", firstIndex: nonMono });
  return out;
}

/**
 * Parses the clean format (one `Label: text` line per paragraph) plus its meta array.
 * `meta` is the already-parsed JSON (`undefined` when missing/invalid; pass the warnings from
 * `readMeta` in `preWarnings`).
 */
export function parseClean(
  text: string,
  meta: unknown,
  preWarnings: ParseWarning[] = [],
): ParsedTranscript {
  const warnings: ParseWarning[] = [...preWarnings];
  const lines = stripBom(text)
    .split(/\r?\n/)
    .filter((l) => l.length > 0);
  let metaArr: unknown[] = [];
  if (Array.isArray(meta)) metaArr = meta;
  else if (meta !== undefined && preWarnings.length === 0)
    warnings.push({ code: "meta_invalid_json" });
  else if (meta === undefined && preWarnings.length === 0) warnings.push({ code: "meta_missing" });

  if (Array.isArray(meta) && meta.length !== lines.length) {
    warnings.push({
      code: "meta_length_mismatch",
      textLines: lines.length,
      metaItems: meta.length,
    });
  }
  let sanitized = 0;
  const paragraphs: Paragraph[] = lines.map((line, i) => {
    const m = metaArr[i];
    const mm = isRecord(m) ? m : {};
    const { label, body } = splitLabel(line);
    let speaker = label;
    if (typeof mm.speaker === "string" && mm.speaker !== "") {
      const clean = sanitizeSpeaker(mm.speaker);
      if (clean !== mm.speaker) sanitized++;
      if (clean !== "") speaker = clean;
    }
    const s = mm.seconds;
    const seconds = typeof s === "number" && Number.isFinite(s) && s >= 0 ? s : -1;
    const estado = isEstado(mm.estado) ? mm.estado : "pendiente";
    return { id: i, speaker, text: body, seconds, estado };
  });
  if (sanitized > 0) warnings.push({ code: "speaker_sanitized", count: sanitized });
  warnings.push(...timingWarnings(paragraphs));
  return { format: "clean", paragraphs, warnings };
}

const STAMP_RE = /^\[(\d{2,}):([0-5]\d):([0-5]\d)\][ \t]*/;

/** Parses a raw transcript (`[HH:MM:SS] SPEAKER_01: text`). The raw file is never modified. */
export function parseRaw(text: string): ParsedTranscript {
  const warnings: ParseWarning[] = [];
  const paragraphs: Paragraph[] = [];
  let unstamped = 0;
  let emptyStamped = 0;
  for (const line of stripBom(text).split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const m = STAMP_RE.exec(line);
    let seconds = -1;
    let rest = line;
    if (m) {
      seconds = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
      rest = line.slice(m[0].length);
      if (rest.trim() === "") {
        emptyStamped++;
        continue;
      }
    } else {
      unstamped++;
    }
    const { label, body } = splitLabel(rest);
    paragraphs.push({
      id: paragraphs.length,
      speaker: label,
      text: body,
      seconds,
      estado: "pendiente",
    });
  }
  if (unstamped > 0) warnings.push({ code: "raw_unstamped_lines", count: unstamped });
  if (emptyStamped > 0) warnings.push({ code: "raw_empty_stamped_lines", count: emptyStamped });
  warnings.push(...timingWarnings(paragraphs));
  return { format: "raw", paragraphs, warnings };
}

/** Looks at the first 20 non-blank lines: `raw` when at least half carry a `[HH:MM:SS]` stamp. */
export function detectFormat(text: string): TranscriptFormat {
  const lines = stripBom(text)
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .slice(0, 20);
  if (lines.length === 0) return "clean";
  const stamped = lines.filter((l) => STAMP_RE.test(l)).length;
  return stamped >= 1 && stamped / lines.length >= 0.5 ? "raw" : "clean";
}

export interface SerializeOptions {
  /** Throw `InvariantError` instead of writing a placeholder for an empty line. */
  strict?: boolean;
}

/** Serializes paragraphs to the clean text + meta pair. Never produces an empty line. */
export function serializeClean(
  paragraphs: readonly Paragraph[],
  opts: SerializeOptions = {},
): { text: string; meta: ParagraphMeta[] } {
  const lines = paragraphs.map((p) => {
    const line = p.speaker ? `${p.speaker}: ${p.text}` : p.text;
    if (line === "") {
      if (opts.strict)
        throw new InvariantError(`paragraph ${p.id} would serialize to an empty line`);
      return " ";
    }
    return line;
  });
  const text = lines.length === 0 ? "" : lines.join("\n") + "\n";
  const meta = paragraphs.map(({ seconds, speaker, estado }) => ({ seconds, speaker, estado }));
  return { text, meta };
}

/** Serializes the meta array as written to disk. */
export function serializeMeta(meta: readonly ParagraphMeta[]): string {
  return JSON.stringify(meta, null, 2) + "\n";
}

/** Chooses non-colliding names for the edited copy of a raw transcript. */
export function planEditedNames(
  rawName: string,
  existing: ReadonlySet<string>,
): { texto: string; meta: string } {
  const base = rawName.replace(/\.txt$/i, "");
  for (let n = 1; ; n++) {
    const suffixText = n === 1 ? ".editado.txt" : `.editado-${n}.txt`;
    const suffixMeta = n === 1 ? ".meta.json" : `.editado-${n}.meta.json`;
    // Keep each name within 255 chars by truncating the base if needed.
    const room = 255 - Math.max(suffixText.length, suffixMeta.length);
    let b = base.length > room ? base.slice(0, room) : base;
    if (b.length > 0 && /[\ud800-\udbff]$/.test(b)) b = b.slice(0, -1);
    b = b.replace(/[ .]+$/, "");
    const texto = `${b}${suffixText}`;
    const meta = `${b}${suffixMeta}`;
    if (existing.has(texto) || existing.has(meta)) continue;
    if (!validateFileName(texto).ok || !validateFileName(meta).ok) {
      // Extremely unusual base (e.g. reserved name): fall back to a neutral base.
      const fallbackText = `transcript${suffixText}`;
      const fallbackMeta = `transcript${suffixMeta}`;
      if (existing.has(fallbackText) || existing.has(fallbackMeta)) continue;
      return { texto: fallbackText, meta: fallbackMeta };
    }
    return { texto, meta };
  }
}
