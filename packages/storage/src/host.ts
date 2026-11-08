import type {
  Config,
  FileKind,
  SessionState,
  SessionStateInput,
  SettingsPatch,
} from "@transcript-editor/core";

export type HostErrorCode =
  | "invalid_argument"
  | "not_authorized"
  | "outside_project"
  | "invalid_name"
  | "not_found"
  | "permission_denied"
  | "too_large"
  | "conflict"
  | "io_error"
  | "cancelled"
  | "unsupported";

export interface HostError {
  code: HostErrorCode;
  /** English, for logs only. The UI shows translated text keyed by `code`. */
  message: string;
}
export type Result<T> = { ok: true; value: T } | { ok: false; error: HostError };
export type Unsubscribe = () => void;

/** Max entries returned by `listFiles`; the UI warns when reached. */
export const MAX_LIST = 5000;
/** Max size of text files read or written through the host. */
export const MAX_TEXT_BYTES = 20 * 1024 * 1024;

export interface ProjectHandle {
  /** Random 128-bit hex, valid for this window until `project.close`. */
  projectId: string;
  /** sha256(realpath(folder)) hex, first 32 chars. Stable across runs; key of state.json. */
  projectKey: string;
  displayName: string;
  /** Absolute path for display and recents only. Never accepted as input. */
  displayPath: string;
}

export interface FileEntry {
  name: string;
  kind: FileKind;
  size: number;
  mtimeMs: number;
}
export interface TextFile {
  content: string;
  /** `${mtimeMs}:${size}`, compared only for equality. */
  version: string;
}
export interface WriteResult {
  version: string;
}

export type MenuCommand = "open-folder" | "save" | "show-help" | "toggle-sidebar" | "check-updates";
export type UpdateStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available"; version: string; url: string }
  | { state: "none" }
  | { state: "error"; message: string };

export type SettingsView = Config & { recovered: boolean };
export type { SettingsPatch, SessionState, SessionStateInput };

export type HostPlatform = "darwin" | "win32" | "linux" | "web";

export interface AppInfo {
  name: string;
  version: string;
  platform: HostPlatform;
  locale: string;
  isPackaged: boolean;
}

/**
 * The only door between the UI and the outside world. Implemented by apps/desktop through
 * contextBridge + IPC; a web edition would implement it with fetch / File System Access.
 * Methods never throw: failures come back as `Result` errors.
 */
export interface HostApi {
  readonly platform: HostPlatform;
  app: {
    getInfo(): Promise<Result<AppInfo>>;
  };
  settings: {
    get(): Promise<Result<SettingsView>>;
    update(patch: SettingsPatch): Promise<Result<SettingsView>>;
  };
  recents: {
    remove(projectKey: string): Promise<Result<SettingsView>>;
    clear(): Promise<Result<SettingsView>>;
  };
  project: {
    pickFolder(): Promise<Result<ProjectHandle | null>>;
    openRecent(projectKey: string): Promise<Result<ProjectHandle>>;
    openSample(): Promise<Result<ProjectHandle>>;
    close(projectId: string): Promise<Result<void>>;
    listFiles(projectId: string): Promise<Result<FileEntry[]>>;
    readText(projectId: string, name: string): Promise<Result<TextFile>>;
    writeText(
      projectId: string,
      name: string,
      content: string,
      opts?: { ifVersion?: string },
    ): Promise<Result<WriteResult>>;
    exists(projectId: string, name: string): Promise<Result<boolean>>;
    mediaUrl(projectId: string, name: string): Promise<Result<string>>;
  };
  session: {
    get(projectKey: string): Promise<Result<SessionState | null>>;
    save(projectKey: string, state: SessionStateInput): Promise<Result<void>>;
  };
  external: { open(url: string): Promise<Result<void>> };
  updates: {
    check(): Promise<Result<void>>;
    onStatus(cb: (s: UpdateStatus) => void): Unsubscribe;
  };
  lifecycle: {
    onMenuCommand(cb: (c: MenuCommand) => void): Unsubscribe;
    onCloseRequested(cb: () => void): Unsubscribe;
    closeDialogOpen(open: boolean): Promise<Result<void>>;
    respondToClose(allow: boolean): Promise<Result<void>>;
  };
}
