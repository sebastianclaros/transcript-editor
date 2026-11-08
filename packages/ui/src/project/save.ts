import {
  defaultProject,
  labelsInOrder,
  planEditedNames,
  serializeClean,
  serializeMeta,
  serializeProject,
  type Paragraph,
  type ProjectFile,
  type TranscriptFormat,
} from "@transcript-editor/core";
import { StorageError, type ProjectSession } from "@transcript-editor/storage";
import { PROJECT_JSON } from "./openFlow";

export interface SaveInput {
  session: ProjectSession;
  paragraphs: Paragraph[];
  pf: ProjectFile | null;
  onDisk: boolean;
  /** The project object changed since it was read or written. */
  pfDirty: boolean;
  format: TranscriptFormat;
  audioName: string;
  textName: string;
  metaName: string | null;
  rawName: string | null;
  existingNames: ReadonlySet<string>;
  strict: boolean;
  /** Retry without `ifVersion` (the user chose "Sobrescribir"). */
  force?: boolean;
}

export type SaveOutcome =
  | {
      ok: true;
      pf: ProjectFile | null;
      onDisk: boolean;
      format: TranscriptFormat;
      textName: string;
      metaName: string;
      rawName: string | null;
      written: string[];
      /** proyecto.json was created or changed because of a raw transcript save. */
      projectCreated: boolean;
    }
  | { ok: false; kind: "conflict"; file: string }
  | { ok: false; kind: "error"; file: string; error: StorageError };

export const defaultMetaName = (textName: string) => `${textName.replace(/\.txt$/i, "")}.meta.json`;

/**
 * Order: texto -> meta -> proyecto.json (design 9.1). Each write is atomic in the host; the three
 * files are not transactional. A failure leaves earlier files written.
 */
export async function performSave(input: SaveInput): Promise<SaveOutcome> {
  const { session } = input;
  const { text, meta } = serializeClean(input.paragraphs, { strict: input.strict });
  const isRaw = input.rawName !== null && input.textName === input.rawName;

  let targetText = input.textName;
  let targetMeta = input.metaName ?? defaultMetaName(input.textName);
  let pf = input.pf;
  let mustWritePf = false;
  let projectCreated = false;

  if (isRaw) {
    const names = planEditedNames(input.rawName as string, input.existingNames);
    targetText = names.texto;
    targetMeta = names.meta;
    const base = pf ?? defaultProject(labelsInOrder(input.paragraphs));
    pf = {
      ...base,
      archivos: {
        ...base.archivos,
        audio: input.audioName,
        texto: targetText,
        meta: targetMeta,
        crudo: input.rawName as string,
      },
    };
    mustWritePf = true;
    projectCreated = input.pf === null;
  } else if (pf && pf.archivos.meta !== targetMeta) {
    pf = { ...pf, archivos: { ...pf.archivos, meta: targetMeta } };
    mustWritePf = true;
  }
  if (input.rawName !== null && (targetText === input.rawName || targetMeta === input.rawName)) {
    // Never write over the original raw transcript.
    return {
      ok: false,
      kind: "error",
      file: input.rawName,
      error: new StorageError("invalid_argument", "refusing to overwrite the raw transcript"),
    };
  }

  const written: string[] = [];
  const write = async (name: string, content: string): Promise<SaveOutcome | null> => {
    try {
      await session.writeText(
        name,
        content,
        input.force ? undefined : { ifVersion: session.versionOf(name) },
      );
      written.push(name);
      return null;
    } catch (e) {
      const error = e instanceof StorageError ? e : new StorageError("io_error", String(e));
      if (error.code === "conflict") return { ok: false, kind: "conflict", file: name };
      return { ok: false, kind: "error", file: name, error };
    }
  };

  let failed = await write(targetText, text);
  if (failed) return failed;
  failed = await write(targetMeta, serializeMeta(meta));
  if (failed) return failed;
  const writePf = pf !== null && (!input.onDisk || input.pfDirty || mustWritePf);
  if (writePf && pf) {
    failed = await write(PROJECT_JSON, serializeProject(pf));
    if (failed) return failed;
  }
  return {
    ok: true,
    pf,
    onDisk: input.onDisk || writePf,
    format: "clean",
    textName: targetText,
    metaName: targetMeta,
    rawName: input.rawName,
    written,
    projectCreated,
  };
}
