import {
  detectFormat,
  parseClean,
  parseRaw,
  readMeta,
  type Archivos,
  type ParseWarning,
  type ProjectFile,
} from "@transcript-editor/core";
import {
  StorageError,
  type ProjectRef,
  type ProjectSession,
  type FileEntry,
} from "@transcript-editor/storage";
import type { LoadedSession } from "./openFlow";

export class MissingFileError extends Error {
  constructor(readonly fileName: string) {
    super(`missing file ${fileName}`);
    this.name = "MissingFileError";
  }
}

interface Args {
  ref: ProjectRef;
  session: ProjectSession;
  files: FileEntry[];
  pf: ProjectFile | null;
  archivos: Archivos;
  onDisk: boolean;
  openPanel: boolean;
  dirty: boolean;
}

async function readOrMissing(session: ProjectSession, name: string) {
  try {
    return await session.readText(name);
  } catch (e) {
    if (e instanceof StorageError && e.code === "not_found") throw new MissingFileError(name);
    throw e;
  }
}

/** Reads texto/meta, parses (clean or raw) and resolves the audio URL. */
export async function loadSession(a: Args): Promise<LoadedSession> {
  const { audio, texto, meta } = a.archivos;
  if (!audio) throw new MissingFileError("audio");
  if (!texto) throw new MissingFileError("texto");
  const text = await readOrMissing(a.session, texto);
  const format = detectFormat(text.content);
  let paragraphs;
  let warnings: ParseWarning[];
  let metaName: string | null = null;
  if (format === "raw") {
    const parsed = parseRaw(text.content);
    paragraphs = parsed.paragraphs;
    warnings = parsed.warnings;
  } else {
    let metaText: string | null = null;
    if (meta) {
      try {
        metaText = (await a.session.readText(meta)).content;
        metaName = meta;
      } catch (e) {
        if (!(e instanceof StorageError && e.code === "not_found")) throw e;
      }
    }
    const rm = readMeta(metaText);
    const parsed = parseClean(text.content, rm.meta, rm.warnings);
    paragraphs = parsed.paragraphs;
    warnings = parsed.warnings;
  }
  let audioUrl: string;
  try {
    audioUrl = await a.session.mediaUrl(audio);
  } catch (e) {
    if (e instanceof StorageError && e.code === "not_found") throw new MissingFileError(audio);
    throw e;
  }
  return {
    ref: a.ref,
    session: a.session,
    pf: a.pf,
    onDisk: a.onDisk,
    initialDirty: a.dirty,
    panelMode: a.openPanel ? (a.pf ? "edit" : "readonly") : "closed",
    format,
    paragraphs,
    warnings,
    audioName: audio,
    audioUrl,
    textName: texto,
    metaName: format === "raw" ? null : (metaName ?? meta ?? null),
    rawName: format === "raw" ? texto : null,
    files: a.files,
  };
}
