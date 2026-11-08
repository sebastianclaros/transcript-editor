export type FileKind = "audio" | "text" | "json" | "other";

const AUDIO_EXT = new Set(["mp4", "m4a", "mp3", "wav", "ogg"]);

function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

/**
 * Classifies a file by extension. `.mp4` counts as audio because the pipeline's merged video is
 * used as the audio source.
 */
export function fileKindOf(name: string): FileKind {
  const ext = extensionOf(name);
  if (AUDIO_EXT.has(ext)) return "audio";
  if (ext === "txt") return "text";
  if (ext === "json") return "json";
  return "other";
}

export type FileNameProblem =
  | "not_string"
  | "length"
  | "control_char"
  | "separator"
  | "dot_name"
  | "dotfile"
  | "trailing"
  | "reserved";

export type FileNameCheck = { ok: true } | { ok: false; reason: FileNameProblem };

const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/;
const SEPARATORS = /[/\\:*?"<>|]/;

/** Validates a flat file name (top level of a project folder). Shared by renderer and main. */
export function validateFileName(name: unknown): FileNameCheck {
  if (typeof name !== "string") return { ok: false, reason: "not_string" };
  if (name.length < 1 || name.length > 255) return { ok: false, reason: "length" };
  if (CONTROL.test(name)) return { ok: false, reason: "control_char" };
  if (SEPARATORS.test(name)) return { ok: false, reason: "separator" };
  if (name === "." || name === "..") return { ok: false, reason: "dot_name" };
  if (name.startsWith(".")) return { ok: false, reason: "dotfile" };
  if (/[ .]$/.test(name)) return { ok: false, reason: "trailing" };
  const stem = name.split(".")[0] ?? "";
  if (RESERVED.test(stem.trim())) return { ok: false, reason: "reserved" };
  return { ok: true };
}

export function isValidFileName(name: unknown): name is string {
  return validateFileName(name).ok;
}
