import { z } from "zod";
import { fileKindOf, validateFileName } from "./files";

export const MOSTRAR = ["etiqueta", "iniciales", "nombre"] as const;
export type Mostrar = (typeof MOSTRAR)[number];

const Color = z
  .preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .transform((s) => s.toLowerCase())
      .nullable(),
  )
  .catch(null);

export const SpeakerSchema = z
  .object({
    id: z.string().min(1),
    nombre: z.string().catch(""),
    iniciales: z.string().catch(""),
    color: Color,
  })
  .passthrough();

export const ArchivosSchema = z
  .object({
    audio: z.string().optional().catch(undefined),
    texto: z.string().optional().catch(undefined),
    meta: z.string().optional().catch(undefined),
    /** Original raw transcript when `texto` was derived from it. */
    crudo: z.string().optional().catch(undefined),
  })
  .passthrough();

export const ProjectFileSchema = z
  .object({
    version: z.number().int().catch(1),
    titulo: z.string().catch(""),
    descripcion: z.string().catch(""),
    archivos: ArchivosSchema.catch({}),
    speakers: z.array(z.unknown()).catch([]),
    visualizacion: z
      .object({
        mostrar: z.enum(MOSTRAR).optional().catch(undefined),
        colorearTexto: z.boolean().catch(true),
      })
      .passthrough()
      .catch({ colorearTexto: true }),
  })
  .passthrough();

export type SpeakerEntry = z.infer<typeof SpeakerSchema>;
export interface Archivos {
  audio?: string | undefined;
  texto?: string | undefined;
  meta?: string | undefined;
  crudo?: string | undefined;
  [key: string]: unknown;
}
export interface Visualizacion {
  mostrar?: Mostrar | undefined;
  colorearTexto: boolean;
  [key: string]: unknown;
}
/** Unknown top-level keys are preserved (index signature) and written back. */
export interface ProjectFile {
  version: number;
  titulo: string;
  descripcion: string;
  archivos: Archivos;
  speakers: SpeakerEntry[];
  visualizacion: Visualizacion;
  [key: string]: unknown;
}

export const PROJECT_VERSION = 1;
export const PROJECT_FILE_NAME = "proyecto.json";

export type ProjectWarning =
  | { code: "newer_version"; version: number }
  | { code: "speaker_dropped"; index: number }
  | { code: "speaker_duplicate"; id: string }
  | { code: "invalid_file_reference"; field: string };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Version migrations. Returns the raw object with a valid version, and whether it is newer. */
export function migrateProject(raw: Record<string, unknown>): {
  raw: Record<string, unknown>;
  newer: boolean;
} {
  const v = raw.version;
  const version = typeof v === "number" && Number.isInteger(v) && v >= 1 ? v : 1;
  return { raw: { ...raw, version }, newer: version > PROJECT_VERSION };
}

export function parseProjectFile(
  raw: unknown,
): { project: ProjectFile; warnings: ProjectWarning[] } | { error: "not_an_object" } {
  if (!isPlainObject(raw)) return { error: "not_an_object" };
  const warnings: ProjectWarning[] = [];
  const { raw: migrated, newer } = migrateProject(raw);
  const base = ProjectFileSchema.parse(migrated);
  if (newer) warnings.push({ code: "newer_version", version: base.version });

  const speakers: SpeakerEntry[] = [];
  const seen = new Set<string>();
  base.speakers.forEach((row, index) => {
    const parsed = SpeakerSchema.safeParse(row);
    if (!parsed.success) {
      warnings.push({ code: "speaker_dropped", index });
      return;
    }
    if (seen.has(parsed.data.id)) {
      warnings.push({ code: "speaker_duplicate", id: parsed.data.id });
      return;
    }
    seen.add(parsed.data.id);
    speakers.push(parsed.data);
  });

  const archivos: Archivos = { ...base.archivos };
  for (const field of ["audio", "texto", "meta", "crudo"] as const) {
    const value = archivos[field];
    if (value !== undefined && !validateFileName(value).ok) {
      delete archivos[field];
      warnings.push({ code: "invalid_file_reference", field });
    }
  }
  return { project: { ...base, archivos, speakers } as ProjectFile, warnings };
}

export function emptyProject(): ProjectFile {
  return {
    version: PROJECT_VERSION,
    titulo: "",
    descripcion: "",
    archivos: {},
    speakers: [],
    visualizacion: { colorearTexto: true },
  };
}

/** Serializes for disk: stable key order for the known keys, unknown keys preserved. */
export function serializeProject(p: ProjectFile): string {
  const visualizacion: Record<string, unknown> = { ...p.visualizacion };
  if (!visualizacion.mostrar) delete visualizacion.mostrar;
  const speakers = p.speakers.map((s) => ({ ...s, color: s.color || null }));
  const out = { ...p, version: Math.max(p.version, PROJECT_VERSION), speakers, visualizacion };
  return JSON.stringify(out, null, 2) + "\n";
}

export function isProjectResolved(p: ProjectFile): boolean {
  return Boolean(p.archivos.audio && p.archivos.texto);
}

/** Throws when the project cannot be written yet (audio and texto are required). */
export function assertResolved(p: ProjectFile): void {
  if (!isProjectResolved(p))
    throw new Error("proyecto.json needs archivos.audio and archivos.texto");
}

export interface DirEntry {
  name: string;
  kind: ReturnType<typeof fileKindOf>;
}

export interface DetectedFiles {
  audio?: string;
  texto?: string;
  meta?: string;
}

const isProjectJson = (n: string) => /^proyecto(\.bak(-\d+)?)?\.json$/i.test(n);

/**
 * Guesses which files make up a session. Prefers `unido.*` (output of the merge pipeline), then
 * the only candidate of each kind. Ignores proyecto.json and its backups.
 */
export function detectFiles(entries: readonly DirEntry[]): DetectedFiles {
  const names = new Set(entries.map((e) => e.name));
  const out: DetectedFiles = {};
  const audios = entries.filter((e) => e.kind === "audio").map((e) => e.name);
  if (names.has("unido.mp4")) out.audio = "unido.mp4";
  else if (audios.length === 1) out.audio = audios[0];

  const texts = entries.filter((e) => e.kind === "text").map((e) => e.name);
  if (names.has("unido.txt")) out.texto = "unido.txt";
  else if (texts.length === 1) out.texto = texts[0];
  else if (texts.length > 1) {
    // A raw transcript next to its edited copy: the edited copy is the user's work.
    const edited = texts.filter((t) => /\.editado(-\d+)?\.txt$/i.test(t));
    if (edited.length === 1) out.texto = edited[0];
  }

  if (out.texto) {
    const sibling = out.texto.replace(/\.txt$/i, "") + ".meta.json";
    if (names.has(sibling)) out.meta = sibling;
  }
  if (!out.meta && names.has("unido.meta.json")) out.meta = "unido.meta.json";
  if (!out.meta) {
    const jsons = entries
      .filter((e) => e.kind === "json" && !isProjectJson(e.name) && /\.meta\.json$/i.test(e.name))
      .map((e) => e.name);
    if (jsons.length === 1) out.meta = jsons[0];
  }
  return out;
}
