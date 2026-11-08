import type { Paragraph } from "./paragraphs";

/** Index of the active paragraph: by id when set, else the last timed paragraph at time `t`. */
export function activeIndex(
  paragraphs: readonly Paragraph[],
  activeId: number | null,
  t: number,
): number {
  if (activeId != null) {
    const i = paragraphs.findIndex((p) => p.id === activeId);
    if (i >= 0) return i;
  }
  let idx = -1;
  for (let i = 0; i < paragraphs.length; i++) {
    const s = paragraphs[i]?.seconds ?? -1;
    if (s >= 0 && s <= t) idx = i;
    else if (s >= 0) break;
  }
  return idx;
}

export type StartTarget = { seconds: number; kind: "start" | "previous" };

/**
 * Target of "start of paragraph": the active paragraph start, or the previous timed paragraph when
 * already within 1.2 s (scaled by playback rate) of the start.
 */
export function paragraphStartTarget(
  paragraphs: readonly Paragraph[],
  activeId: number | null,
  t: number,
  rate: number,
): StartTarget | null {
  const idx = activeIndex(paragraphs, activeId, t);
  if (idx < 0) return null;
  const start = paragraphs[idx]?.seconds ?? -1;
  if (start >= 0 && t - start < 1.2 * (rate || 1)) {
    for (let j = idx - 1; j >= 0; j--) {
      const s = paragraphs[j]?.seconds ?? -1;
      if (s >= 0) return { seconds: s, kind: "previous" };
    }
  }
  return start >= 0 ? { seconds: start, kind: "start" } : null;
}

/** Start time of the next timed paragraph after the active one, or null. */
export function nextParagraphTarget(
  paragraphs: readonly Paragraph[],
  activeId: number | null,
  t: number,
): number | null {
  const idx = activeIndex(paragraphs, activeId, t);
  for (let j = idx + 1; j < paragraphs.length; j++) {
    const s = paragraphs[j]?.seconds ?? -1;
    if (s >= 0) return s;
  }
  return null;
}
