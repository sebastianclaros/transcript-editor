import { ESTADOS, type Estado, type Paragraph } from "./paragraphs";
import { normalizeText } from "./text";

export const ESTADO_COLORS: Record<Estado, string> = {
  pendiente: "#4a5160",
  leido: "#4f8cff",
  corregido: "#ff9f43",
  verificado: "#35c759",
};

export interface Change {
  paragraphs: Paragraph[];
  /** False when nothing changed (the same array instance is returned). */
  changed: boolean;
}

/**
 * Id of the paragraph being spoken at time `t`: the last timed paragraph with `seconds <= t`,
 * stopping at the first timed paragraph that starts later (prototype scan, not binary search).
 */
export function lineAt(paragraphs: readonly Paragraph[], t: number): number | null {
  let found: number | null = null;
  for (const p of paragraphs) {
    if (p.seconds < 0) continue;
    if (p.seconds <= t) found = p.id;
    else break;
  }
  return found;
}

/** Applies an edit to one paragraph. Empty or unchanged text returns the same object. */
export function applyEdit(p: Paragraph, rawText: string): Paragraph {
  const normalized = normalizeText(rawText);
  if (normalized === "" || normalized === p.text) return p;
  return { ...p, text: normalized, estado: "corregido" };
}

function mapOne(paragraphs: Paragraph[], id: number, fn: (p: Paragraph) => Paragraph): Change {
  let changed = false;
  const next = paragraphs.map((p) => {
    if (p.id !== id) return p;
    const q = fn(p);
    if (q !== p) changed = true;
    return q;
  });
  return changed ? { paragraphs: next, changed } : { paragraphs, changed: false };
}

export function editParagraph(paragraphs: Paragraph[], id: number, rawText: string): Change {
  return mapOne(paragraphs, id, (p) => applyEdit(p, rawText));
}

export function setEstado(paragraphs: Paragraph[], id: number, estado: Estado): Change {
  return mapOne(paragraphs, id, (p) => (p.estado === estado ? p : { ...p, estado }));
}

export function nextEstado(e: Estado): Estado {
  const i = ESTADOS.indexOf(e);
  return ESTADOS[(i + 1) % ESTADOS.length] ?? "pendiente";
}

export function cycleEstado(paragraphs: Paragraph[], id: number): Change {
  return mapOne(paragraphs, id, (p) => ({ ...p, estado: nextEstado(p.estado) }));
}

/** Playback entered the paragraph: only `pendiente -> leido`, never downgrades. */
export function markRead(paragraphs: Paragraph[], id: number): Change {
  return mapOne(paragraphs, id, (p) => (p.estado === "pendiente" ? { ...p, estado: "leido" } : p));
}

export function markVerified(paragraphs: Paragraph[], id: number): Change {
  return setEstado(paragraphs, id, "verificado");
}

export function countByEstado(paragraphs: readonly Paragraph[]): Record<Estado, number> {
  const counts: Record<Estado, number> = { pendiente: 0, leido: 0, corregido: 0, verificado: 0 };
  for (const p of paragraphs) counts[p.estado]++;
  return counts;
}
