export const ESTADOS = ["pendiente", "leido", "corregido", "verificado"] as const;
export type Estado = (typeof ESTADOS)[number];

export function isEstado(v: unknown): v is Estado {
  return typeof v === "string" && (ESTADOS as readonly string[]).includes(v);
}

export interface Paragraph {
  /** Zero-based index at load time. Never changes during a session. */
  id: number;
  speaker: string;
  text: string;
  /** Start time in seconds; -1 means unknown. */
  seconds: number;
  estado: Estado;
}

/** Element of the meta JSON file (same length and order as the text lines). */
export interface ParagraphMeta {
  seconds: number;
  speaker: string;
  estado: Estado;
}

export type TranscriptFormat = "clean" | "raw";

export type ParseWarning =
  | { code: "meta_missing" }
  | { code: "meta_invalid_json" }
  | { code: "meta_length_mismatch"; textLines: number; metaItems: number }
  | { code: "no_times" }
  | { code: "non_monotonic_times"; firstIndex: number }
  | { code: "raw_unstamped_lines"; count: number }
  | { code: "raw_empty_stamped_lines"; count: number }
  | { code: "speaker_sanitized"; count: number };

export interface ParsedTranscript {
  format: TranscriptFormat;
  paragraphs: Paragraph[];
  warnings: ParseWarning[];
}
