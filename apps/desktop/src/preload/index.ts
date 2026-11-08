import { contextBridge, ipcRenderer } from "electron";
import type {
  AppInfo,
  FileEntry,
  HostApi,
  MenuCommand,
  ProjectHandle,
  Result,
  SettingsView,
  TextFile,
  UpdateStatus,
  WriteResult,
} from "@transcript-editor/storage";
import type { SessionState, SessionStateInput, SettingsPatch } from "@transcript-editor/core";
import { CH } from "../shared/channels";

// The ONLY surface exposed to the renderer. Every method is a thin `ipcRenderer.invoke`;
// subscriptions forward the payload only (never the IpcRendererEvent). No generic invoke.
const invoke = <T>(channel: string, ...args: unknown[]) =>
  ipcRenderer.invoke(channel, ...args) as Promise<Result<T>>;

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_event: unknown, payload: T) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

const host: HostApi = {
  platform:
    process.platform === "darwin" || process.platform === "win32" ? process.platform : "linux",
  app: { getInfo: () => invoke<AppInfo>(CH.appGetInfo) },
  settings: {
    get: () => invoke<SettingsView>(CH.settingsGet),
    update: (patch: SettingsPatch) => invoke<SettingsView>(CH.settingsUpdate, patch),
  },
  recents: {
    remove: (key) => invoke<SettingsView>(CH.recentsRemove, key),
    clear: () => invoke<SettingsView>(CH.recentsClear),
  },
  project: {
    pickFolder: () => invoke<ProjectHandle | null>(CH.projectPickFolder),
    openRecent: (key) => invoke<ProjectHandle>(CH.projectOpenRecent, key),
    openSample: () => invoke<ProjectHandle>(CH.projectOpenSample),
    close: (id) => invoke<void>(CH.projectClose, id),
    listFiles: (id) => invoke<FileEntry[]>(CH.projectListFiles, id),
    readText: (id, name) => invoke<TextFile>(CH.projectReadText, id, name),
    writeText: (id, name, content, opts) =>
      invoke<WriteResult>(CH.projectWriteText, id, name, content, opts),
    exists: (id, name) => invoke<boolean>(CH.projectExists, id, name),
    mediaUrl: (id, name) => invoke<string>(CH.projectMediaUrl, id, name),
  },
  session: {
    get: (key) => invoke<SessionState | null>(CH.sessionGet, key),
    save: (key, state: SessionStateInput) => invoke<void>(CH.sessionSave, key, state),
  },
  external: { open: (url) => invoke<void>(CH.externalOpen, url) },
  updates: {
    check: () => invoke<void>(CH.updatesCheck),
    onStatus: (cb) => subscribe<UpdateStatus>(CH.eventUpdateStatus, cb),
  },
  lifecycle: {
    onMenuCommand: (cb) => subscribe<MenuCommand>(CH.eventMenuCommand, cb),
    onCloseRequested: (cb) => subscribe<undefined>(CH.eventCloseRequested, () => cb()),
    closeDialogOpen: (open) => invoke<void>(CH.closeDialogOpen, open),
    respondToClose: (allow) => invoke<void>(CH.respondToClose, allow),
  },
};

contextBridge.exposeInMainWorld("host", host);
