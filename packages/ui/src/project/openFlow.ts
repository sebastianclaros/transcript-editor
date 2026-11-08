import {
  detectFiles,
  emptyProject,
  type Archivos,
  type DetectedFiles,
  type ParseWarning,
  type Paragraph,
  type ProjectFile,
  type ProjectWarning,
  type TranscriptFormat,
} from "@transcript-editor/core";
import type { FileEntry, ProjectRef, ProjectSession } from "@transcript-editor/storage";

/** Everything the editor needs once a project is loaded. */
export interface LoadedSession {
  ref: ProjectRef;
  session: ProjectSession;
  pf: ProjectFile | null;
  onDisk: boolean;
  /** True when the project file or mapping has unsaved changes at load time. */
  initialDirty: boolean;
  panelMode: "closed" | "edit" | "readonly";
  format: TranscriptFormat;
  paragraphs: Paragraph[];
  warnings: ParseWarning[];
  audioName: string;
  audioUrl: string;
  textName: string;
  metaName: string | null;
  /** Name of the raw transcript when `format` is raw (never written). */
  rawName: string | null;
  /** Set for a project that was created from this folder in this session. */
  files: FileEntry[];
}

export interface UiError {
  code: string;
  message?: string;
}

export type MappingReason = "new-folder" | "missing-files" | "ambiguous";

export type OpenState =
  | { s: "welcome" }
  | { s: "picking"; from: Extract<OpenState, { s: "ready" }> | null }
  | { s: "resolving"; project: ProjectRef }
  | { s: "askCreate"; project: ProjectRef; files: FileEntry[]; detected: DetectedFiles }
  | {
      s: "projectDamaged";
      project: ProjectRef;
      files: FileEntry[];
      rawText: string;
      parseError: string;
    }
  | {
      s: "jsonView";
      project: ProjectRef;
      files: FileEntry[];
      rawText: string;
      parseError: string | null;
    }
  | {
      s: "mapping";
      project: ProjectRef;
      files: FileEntry[];
      draft: ProjectFile;
      reason: MappingReason;
      createProject: boolean;
      missing: string[];
    }
  | {
      s: "loading";
      project: ProjectRef;
      files: FileEntry[];
      pf: ProjectFile | null;
      archivos: Archivos;
      onDisk: boolean;
      openPanel: boolean;
      dirty: boolean;
    }
  | { s: "ready"; project: ProjectRef; loaded: LoadedSession }
  | { s: "failed"; error: UiError };

export type ResolveResult =
  | { kind: "noProject"; files: FileEntry[] }
  | { kind: "damaged"; files: FileEntry[]; rawText: string; parseError: string }
  | { kind: "ok"; files: FileEntry[]; pf: ProjectFile; warnings: ProjectWarning[] };

export type OpenEvent =
  | { t: "PICK" }
  | { t: "PICKED"; project: ProjectRef | null }
  | { t: "OPEN"; project: ProjectRef }
  | { t: "RESOLVED"; result: ResolveResult }
  | { t: "CREATE" }
  | { t: "CONTINUE" }
  | { t: "CANCEL" }
  | { t: "DAMAGED_VIEW" }
  | { t: "DAMAGED_IGNORED"; files: FileEntry[] }
  | { t: "JSON_CANCEL" }
  | { t: "JSON_APPLY"; pf: ProjectFile }
  | { t: "MAP_CONFIRM"; draft: ProjectFile; save: boolean }
  | { t: "LOADED"; loaded: LoadedSession }
  | { t: "LOAD_NOT_FOUND"; name: string }
  | { t: "FAIL"; error: UiError }
  | { t: "DISMISS" }
  | { t: "CLOSE" };

export const PROJECT_JSON = "proyecto.json";

const names = (files: FileEntry[]) => new Set(files.map((f) => f.name));

/** Names referenced by `archivos` that are not present in the folder (meta is optional). */
export function missingFiles(archivos: Archivos, files: FileEntry[]): string[] {
  const have = names(files);
  const out: string[] = [];
  if (!archivos.audio || !have.has(archivos.audio)) out.push(archivos.audio ?? "audio");
  if (!archivos.texto || !have.has(archivos.texto)) out.push(archivos.texto ?? "texto");
  return out;
}

function draftFrom(archivos: Archivos, base?: ProjectFile): ProjectFile {
  const clean: Archivos = {};
  for (const k of ["audio", "texto", "meta", "crudo"] as const) {
    if (archivos[k]) clean[k] = archivos[k];
  }
  return { ...(base ?? emptyProject()), archivos: base ? { ...base.archivos, ...clean } : clean };
}

function fromProject(
  project: ProjectRef,
  files: FileEntry[],
  pf: ProjectFile,
  dirty: boolean,
): OpenState {
  const have = names(files);
  const detected = detectFiles(files);
  const missing = missingFiles(pf.archivos, files);
  if (missing.length > 0) {
    // Prefill with what resolves, falling back to detection for the rest.
    const merged: Archivos = { ...pf.archivos };
    if (!merged.audio || !have.has(merged.audio)) delete merged.audio;
    if (!merged.texto || !have.has(merged.texto)) delete merged.texto;
    if (merged.meta && !have.has(merged.meta)) delete merged.meta;
    if (!merged.audio && detected.audio) merged.audio = detected.audio;
    if (!merged.texto && detected.texto) merged.texto = detected.texto;
    return {
      s: "mapping",
      project,
      files,
      draft: { ...pf, archivos: merged },
      reason: "missing-files",
      createProject: false,
      missing,
    };
  }
  const archivos = { ...pf.archivos };
  if (archivos.meta && !have.has(archivos.meta)) delete archivos.meta;
  return {
    s: "loading",
    project,
    files,
    pf,
    archivos,
    onDisk: true,
    openPanel: false,
    dirty,
  };
}

/** Pure reducer. Events that make no sense in the current state are ignored. */
export function reduce(state: OpenState, e: OpenEvent): OpenState {
  switch (e.t) {
    case "PICK":
      if (state.s === "ready") return { s: "picking", from: state };
      return state.s === "welcome" || state.s === "failed" ? { s: "picking", from: null } : state;
    case "PICKED":
      if (state.s !== "picking") return state;
      // Cancelling the native dialog returns to where we were (the open editor, or the welcome screen).
      return e.project ? { s: "resolving", project: e.project } : (state.from ?? { s: "welcome" });
    case "OPEN":
      return state.s === "welcome" || state.s === "ready" || state.s === "failed"
        ? { s: "resolving", project: e.project }
        : state;
    case "RESOLVED": {
      if (state.s !== "resolving") return state;
      const r = e.result;
      if (r.kind === "noProject") {
        return {
          s: "askCreate",
          project: state.project,
          files: r.files,
          detected: detectFiles(r.files),
        };
      }
      if (r.kind === "damaged") {
        return {
          s: "projectDamaged",
          project: state.project,
          files: r.files,
          rawText: r.rawText,
          parseError: r.parseError,
        };
      }
      return fromProject(state.project, r.files, r.pf, false);
    }
    case "CREATE": {
      if (state.s !== "askCreate") return state;
      return {
        s: "mapping",
        project: state.project,
        files: state.files,
        draft: draftFrom({ ...state.detected }),
        reason: "new-folder",
        createProject: true,
        missing: [],
      };
    }
    case "CONTINUE": {
      if (state.s !== "askCreate") return state;
      const d = state.detected;
      if (d.audio && d.texto) {
        return {
          s: "loading",
          project: state.project,
          files: state.files,
          pf: null,
          archivos: { ...d },
          onDisk: false,
          openPanel: true,
          dirty: false,
        };
      }
      return {
        s: "mapping",
        project: state.project,
        files: state.files,
        draft: draftFrom({ ...d }),
        reason: "ambiguous",
        createProject: false,
        missing: [],
      };
    }
    case "CANCEL":
      return state.s === "askCreate" ||
        state.s === "projectDamaged" ||
        state.s === "mapping" ||
        state.s === "resolving"
        ? { s: "welcome" }
        : state;
    case "DAMAGED_VIEW":
      return state.s === "projectDamaged"
        ? { ...state, s: "jsonView", parseError: state.parseError }
        : state;
    case "DAMAGED_IGNORED":
      return state.s === "projectDamaged"
        ? { s: "askCreate", project: state.project, files: e.files, detected: detectFiles(e.files) }
        : state;
    case "JSON_CANCEL":
      return state.s === "jsonView"
        ? {
            s: "projectDamaged",
            project: state.project,
            files: state.files,
            rawText: state.rawText,
            parseError: state.parseError ?? "",
          }
        : state;
    case "JSON_APPLY":
      return state.s === "jsonView" ? fromProject(state.project, state.files, e.pf, true) : state;
    case "MAP_CONFIRM": {
      if (state.s !== "mapping") return state;
      const exists = names(state.files).has(PROJECT_JSON);
      const keep = state.createProject || e.save;
      return {
        s: "loading",
        project: state.project,
        files: state.files,
        pf: keep ? e.draft : null,
        archivos: e.draft.archivos,
        onDisk: keep ? exists : false,
        openPanel: state.createProject || !keep,
        dirty: keep,
      };
    }
    case "LOADED":
      return state.s === "loading"
        ? { s: "ready", project: state.project, loaded: e.loaded }
        : state;
    case "LOAD_NOT_FOUND": {
      if (state.s !== "loading") return state;
      const base = state.pf ?? emptyProject();
      const merged: Archivos = { ...base.archivos, ...state.archivos };
      const missing = [e.name];
      if (merged.texto === e.name) delete merged.texto;
      if (merged.audio === e.name) delete merged.audio;
      return {
        s: "mapping",
        project: state.project,
        files: state.files,
        draft: { ...base, archivos: merged },
        reason: "missing-files",
        createProject: false,
        missing,
      };
    }
    case "FAIL":
      return { s: "failed", error: e.error };
    case "DISMISS":
      return state.s === "failed" ? { s: "welcome" } : state;
    case "CLOSE":
      return state.s === "ready" ? { s: "welcome" } : state;
  }
}

/** Project (if any) held by a state: used to release handles when leaving it. */
export function projectOf(state: OpenState): ProjectRef | null {
  return "project" in state ? state.project : null;
}
