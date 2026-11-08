/** Collapses line breaks (including U+2028/2029) into one space and trims. */
export function normalizeText(raw: string): string {
  return raw.replace(/[\r\n\u2028\u2029]+/g, " ").trim();
}

export const MAX_LABEL = 40;
const LABEL_RE = /^([^:]{1,40}):\s*([\s\S]*)$/;

/**
 * Splits `Label: body`. Degenerate labels (blank label AND blank body, e.g. `"  :"`) are not split:
 * the whole line is the body and the label is empty (design 6.2).
 */
export function splitLabel(line: string): { label: string; body: string } {
  const m = LABEL_RE.exec(line);
  if (!m) return { label: "", body: line };
  const label = m[1] ?? "";
  const body = m[2] ?? "";
  if (label.trim() === "" && body.trim() === "") return { label: "", body: line };
  return { label: label.trim(), body };
}

function truncateUnits(s: string, max: number): string {
  if (s.length <= max) return s;
  let end = max;
  const code = s.charCodeAt(end - 1);
  if (code >= 0xd800 && code <= 0xdbff) end -= 1; // do not cut a surrogate pair
  return s.slice(0, end);
}

/**
 * Makes a speaker label safe for `speaker + ": " + text` round trips: no line breaks, no `:`
 * (replaced by U+2236), at most 40 UTF-16 units.
 */
export function sanitizeSpeaker(s: string): string {
  return truncateUnits(normalizeText(s).replace(/:/g, "\u2236"), MAX_LABEL).trim();
}
