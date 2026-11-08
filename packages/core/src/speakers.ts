import type { Mostrar, ProjectFile, SpeakerEntry } from "./project";
import { emptyProject } from "./project";
import type { Paragraph } from "./paragraphs";

export const PALETA = [
  "#7fd1ff",
  "#ffc47f",
  "#9be59b",
  "#f58fc7",
  "#c3a1ff",
  "#ffe27a",
  "#7fe0c8",
  "#ff8f7f",
] as const;
export const GRIS = "#6b7280";

/** Distinct speaker values by first appearance (the empty string is included). */
export function labelsInOrder(paragraphs: readonly Paragraph[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of paragraphs) {
    if (!seen.has(p.speaker)) {
      seen.add(p.speaker);
      out.push(p.speaker);
    }
  }
  return out;
}

/** A project with one speaker row per label and palette colors assigned cyclically. */
export function defaultProject(labels: readonly string[]): ProjectFile {
  const speakers: SpeakerEntry[] = labels
    .filter((id) => id !== "")
    .map((id, i) => ({ id, nombre: "", iniciales: "", color: PALETA[i % PALETA.length] ?? null }));
  return { ...emptyProject(), speakers };
}

/** Text shown for the raw speaker label given the display preference (prototype `etiquetaHablante`). */
export function speakerLabel(
  raw: string,
  entry: SpeakerEntry | undefined,
  mostrar?: Mostrar | "",
): string {
  if (!entry) return raw;
  const m = mostrar || (entry.nombre ? "nombre" : "etiqueta");
  if (m === "nombre") return entry.nombre || entry.iniciales || raw;
  if (m === "iniciales") return entry.iniciales || entry.nombre || raw;
  return raw;
}

export interface SpeakerInfoEntry {
  label: string;
  color: string | null;
  /** True when the project has a row for this speaker. */
  mapeado: boolean;
}
export type SpeakerInfo = ReadonlyMap<string, SpeakerInfoEntry>;

export function buildSpeakerInfo(
  paragraphs: readonly Paragraph[],
  project: ProjectFile,
): SpeakerInfo {
  const byId = new Map(project.speakers.map((s) => [s.id, s] as const));
  const out = new Map<string, SpeakerInfoEntry>();
  for (const raw of labelsInOrder(paragraphs)) {
    const entry = byId.get(raw);
    out.set(raw, {
      label: speakerLabel(raw, entry, project.visualizacion.mostrar),
      color: entry?.color ?? null,
      mapeado: Boolean(entry),
    });
  }
  return out;
}
