/** Formats seconds as `mm:ss` or `hh:mm:ss`; `--:--` for unknown or invalid values (prototype `fmt`). */
export function fmt(sec: number | null | undefined): string {
  if (sec == null || Number.isNaN(sec) || sec < 0 || !Number.isFinite(sec)) return "--:--";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${p(h)}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

/** Parses `mm:ss` or `hh:mm:ss` into seconds; returns null when malformed. */
export function parseClock(text: string): number | null {
  const m = /^(?:(\d+):)?([0-5]?\d):([0-5]\d)$/.exec(text.trim());
  if (!m) return null;
  const h = m[1] ? Number(m[1]) : 0;
  return h * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** Clamps `t` into `[0, max]` (max <= 0 or invalid means no upper bound). */
export function clampTime(t: number, max: number): number {
  const upper = Number.isFinite(max) && max > 0 ? max : Number.POSITIVE_INFINITY;
  return Math.min(Math.max(t, 0), upper);
}
