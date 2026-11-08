import { countByEstado } from "./estado";
import type { Estado, Paragraph } from "./paragraphs";
import { GRIS, type SpeakerInfo } from "./speakers";

export interface MinimapSegment {
  id: number;
  estado: Estado;
  color: string;
  name: string;
  topPct: number;
  heightPct: number;
}
export interface Minimap {
  proportional: boolean;
  segments: MinimapSegment[];
}

/** Marker for paragraphs with no speaker; the UI translates it. */
export const NO_SPEAKER_NAME = "";

export function buildMinimap(
  paragraphs: readonly Paragraph[],
  durationSec: number,
  info: SpeakerInfo,
): Minimap {
  const n = paragraphs.length;
  const proportional = n > 0 && durationSec > 0 && paragraphs.every((p) => p.seconds >= 0);
  const segments = paragraphs.map((p, i): MinimapSegment => {
    const meta = info.get(p.speaker);
    let topPct: number;
    let heightPct: number;
    if (proportional) {
      const next = paragraphs[i + 1]?.seconds ?? durationSec;
      topPct = (p.seconds / durationSec) * 100;
      heightPct = (Math.max(0, next - p.seconds) / durationSec) * 100;
    } else {
      topPct = (i / n) * 100;
      heightPct = 100 / n;
    }
    return {
      id: p.id,
      estado: p.estado,
      color: meta?.color ?? GRIS,
      name: meta?.label ?? (p.speaker || NO_SPEAKER_NAME),
      topPct,
      heightPct,
    };
  });
  return { proportional, segments };
}

/** Playhead position in percent, or null when unknown. */
export function markerPct(
  proportional: boolean,
  t: number,
  dur: number,
  activeIndex: number,
  n: number,
): number | null {
  if (proportional) return dur > 0 ? Math.min(100, Math.max(0, (t / dur) * 100)) : null;
  return activeIndex >= 0 && n > 0 ? ((activeIndex + 0.5) / n) * 100 : null;
}

/** Time to seek to when a segment is clicked: the paragraph start, or null when untimed. */
export function segmentSeek(paragraphs: readonly Paragraph[], id: number): number | null {
  const p = paragraphs.find((q) => q.id === id);
  return p && p.seconds >= 0 ? p.seconds : null;
}

export interface MinimapSummary {
  percent: number;
  remainingSec: number;
  paragraphNumber: number | null;
  total: number;
  counts: Record<Estado, number>;
  verified: number;
}

export function minimapSummary(
  paragraphs: readonly Paragraph[],
  t: number,
  dur: number,
  activeIndex: number,
): MinimapSummary {
  const counts = countByEstado(paragraphs);
  return {
    percent: dur > 0 ? Math.round((t / dur) * 100) : 0,
    remainingSec: Math.max(0, dur - t),
    paragraphNumber: activeIndex >= 0 ? activeIndex + 1 : null,
    total: paragraphs.length,
    counts,
    verified: counts.verificado,
  };
}
