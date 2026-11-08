export type RangeResult =
  { kind: "full" } | { kind: "partial"; start: number; end: number } | { kind: "unsatisfiable" };

/** Parses a single `bytes=` range (RFC 7233). Anything else is served in full. */
export function parseRange(header: string | null | undefined, size: number): RangeResult {
  if (!header) return { kind: "full" };
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return { kind: "full" };
  const a = m[1] ?? "";
  const b = m[2] ?? "";
  if (a === "" && b === "") return { kind: "full" };
  const num = (s: string) => Number(s);
  if (
    (a !== "" && num(a) > Number.MAX_SAFE_INTEGER) ||
    (b !== "" && num(b) > Number.MAX_SAFE_INTEGER)
  ) {
    return { kind: "unsatisfiable" };
  }
  if (size === 0) return { kind: "unsatisfiable" };
  let start: number;
  let end: number;
  if (a === "") {
    const n = num(b);
    if (n === 0) return { kind: "unsatisfiable" };
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = num(a);
    end = b === "" ? size - 1 : Math.min(num(b), size - 1);
  }
  if (start >= size || start > end) return { kind: "unsatisfiable" };
  return { kind: "partial", start, end };
}

export const MEDIA_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
};
