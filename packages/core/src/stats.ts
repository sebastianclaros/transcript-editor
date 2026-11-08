import type { Paragraph } from "./paragraphs";

/** Words = whitespace tokens that contain at least one letter or digit. */
export function countWords(text: string): number {
  let n = 0;
  for (const w of text.split(/\s+/)) if (w && /[\p{L}\p{N}]/u.test(w)) n++;
  return n;
}

export interface SpeakerStats {
  raw: string;
  words: number;
  paragraphs: number;
  timeSec: number;
}
export interface Stats {
  items: SpeakerStats[];
  words: number;
  paragraphs: number;
  timeSec: number;
}

/** Percentage with one decimal; 0 when the total is not positive. */
export function pct(x: number, total: number): number {
  return total > 0 ? Math.round((x / total) * 1000) / 10 : 0;
}

/**
 * Per-speaker statistics in first-appearance order. Time per paragraph runs from its start to the
 * next timed paragraph; the last timed one runs to `durationSec` when known (else counts 0).
 */
export function computeStats(paragraphs: readonly Paragraph[], durationSec: number): Stats {
  const times = new Array<number>(paragraphs.length).fill(0);
  let next: number | null = null;
  for (let i = paragraphs.length - 1; i >= 0; i--) {
    const s = paragraphs[i]?.seconds ?? -1;
    if (s < 0) continue;
    const end: number = next != null ? next : durationSec > 0 ? durationSec : s;
    times[i] = Math.max(0, end - s);
    next = s;
  }
  const by = new Map<string, SpeakerStats>();
  let words = 0;
  let timeSec = 0;
  paragraphs.forEach((p, i) => {
    let it = by.get(p.speaker);
    if (!it) {
      it = { raw: p.speaker, words: 0, paragraphs: 0, timeSec: 0 };
      by.set(p.speaker, it);
    }
    const w = countWords(p.text);
    const t = times[i] ?? 0;
    it.words += w;
    it.paragraphs++;
    it.timeSec += t;
    words += w;
    timeSec += t;
  });
  return { items: [...by.values()], words, paragraphs: paragraphs.length, timeSec };
}
