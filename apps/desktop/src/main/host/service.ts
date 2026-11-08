import nodeFs from "node:fs/promises";
import path from "node:path";
import { BRAND, type SessionStateInput, type SettingsPatch } from "@transcript-editor/core";
import type {
  AppInfo,
  FileEntry,
  ProjectHandle,
  SettingsView,
  TextFile,
  WriteResult,
} from "@transcript-editor/storage";
import { HostFault } from "../fault";
import { listFiles, readTextFile, writeTextFile, type Fs } from "../fs/atomic";
import { authorizeRoot, resolveInProject } from "../fs/authorize";
import { buildMediaUrl } from "../media/handler";
import type { Registry } from "../registry";
import { validateExternalUrl } from "../security";
import type { ConfigStore } from "../store/config";
import type { StateStore } from "../store/state";
import { ensureSample } from "./sample";

export interface ServiceDeps {
  registry: Registry;
  config: ConfigStore;
  state: StateStore;
  fs?: Fs;
  paths: { userData: string; logs: string; documents: string; sampleDir: string };
  /** Native folder dialog parented to the window; null = cancelled. */
  pickFolderDialog(windowId: number): Promise<string | null>;
  appInfo(): AppInfo;
  openExternal(url: string): Promise<void>;
  /** Dev only (`!isPackaged`): folder to open instead of showing the dialog. */
  devOpenDir?: string | null;
  platform?: NodeJS.Platform;
  now?: () => Date;
}

/** The host API as plain async functions of (windowId, args). Throws HostFault; the IPC layer maps it. */
export function createHostService(deps: ServiceDeps) {
  const fs = deps.fs ?? nodeFs;
  const now = deps.now ?? (() => new Date());

  const project = (windowId: number, projectId: string) => {
    const p = deps.registry.getProject(windowId, projectId);
    if (!p) throw new HostFault("not_authorized", "unknown project");
    return p;
  };

  async function openAuthorized(windowId: number, chosen: string): Promise<ProjectHandle> {
    const { root, key } = await authorizeRoot(chosen, {
      fs,
      userData: deps.paths.userData,
      logs: deps.paths.logs,
      platform: deps.platform,
    });
    const name = path.basename(root) || root;
    const p = deps.registry.addProject(windowId, { root, key, displayName: name });
    deps.config.touchProject({ key, path: root, name, lastOpenedAt: now().toISOString() });
    deps.state.touch(key, root, now());
    return { projectId: p.projectId, projectKey: key, displayName: name, displayPath: root };
  }

  /** `session.get/save` accept a key only for an authorized project of this window or a recent. */
  function sessionPath(windowId: number, key: string): string {
    const root = deps.registry.rootOfKey(windowId, key);
    if (root) return root;
    const recent = deps.config.get().recentProjects.find((r) => r.key === key);
    if (!recent) throw new HostFault("not_authorized", "unknown project key");
    return recent.path;
  }

  return {
    appGetInfo: async (): Promise<AppInfo> => deps.appInfo(),
    settingsGet: async (): Promise<SettingsView> => ({
      ...deps.config.get(),
      recovered: deps.config.takeRecovered(),
    }),
    settingsUpdate: async (_w: number, patch: SettingsPatch): Promise<SettingsView> => ({
      ...deps.config.update(patch),
      recovered: false,
    }),
    recentsRemove: async (_w: number, key: string): Promise<SettingsView> => ({
      ...deps.config.removeRecent(key),
      recovered: false,
    }),
    recentsClear: async (): Promise<SettingsView> => ({
      ...deps.config.clearRecents(),
      recovered: false,
    }),

    async pickFolder(windowId: number): Promise<ProjectHandle | null> {
      const chosen = deps.devOpenDir ? deps.devOpenDir : await deps.pickFolderDialog(windowId);
      if (!chosen) return null;
      return openAuthorized(windowId, chosen);
    },
    async openRecent(windowId: number, key: string): Promise<ProjectHandle> {
      const cfg = deps.config.get();
      const recent =
        cfg.recentProjects.find((r) => r.key === key) ??
        (cfg.lastProject?.key === key ? cfg.lastProject : undefined);
      if (!recent) throw new HostFault("not_found", "not in recents");
      return openAuthorized(windowId, recent.path);
    },
    async openSample(windowId: number): Promise<ProjectHandle> {
      const target = await ensureSample({
        sourceDir: deps.paths.sampleDir,
        documentsDir: deps.paths.documents,
        fs,
      });
      return openAuthorized(windowId, target);
    },
    async closeProject(windowId: number, projectId: string): Promise<void> {
      project(windowId, projectId);
      deps.registry.closeProject(windowId, projectId);
    },
    async listFiles(windowId: number, projectId: string): Promise<FileEntry[]> {
      return listFiles(project(windowId, projectId).root, fs);
    },
    async readText(windowId: number, projectId: string, name: string): Promise<TextFile> {
      const p = project(windowId, projectId);
      return readTextFile(await resolveInProject(p.root, name, "read", fs), fs);
    },
    async writeText(
      windowId: number,
      projectId: string,
      name: string,
      content: string,
      opts?: { ifVersion?: string },
    ): Promise<WriteResult> {
      const p = project(windowId, projectId);
      return writeTextFile(
        await resolveInProject(p.root, name, "write", fs),
        content,
        opts?.ifVersion,
        fs,
      );
    },
    async exists(windowId: number, projectId: string, name: string): Promise<boolean> {
      const p = project(windowId, projectId);
      const check = await resolveInProject(
        p.root,
        name,
        name.toLowerCase().endsWith(".json") || name.toLowerCase().endsWith(".txt")
          ? "write"
          : "media",
        fs,
      );
      return fs.stat(check).then(
        (st) => st.isFile(),
        () => false,
      );
    },
    async mediaUrl(windowId: number, projectId: string, name: string): Promise<string> {
      const p = project(windowId, projectId);
      await resolveInProject(p.root, name, "media", fs);
      return buildMediaUrl(BRAND.protocols.media, projectId, name);
    },
    async sessionGet(windowId: number, key: string) {
      sessionPath(windowId, key);
      return deps.state.get(key);
    },
    async sessionSave(windowId: number, key: string, input: SessionStateInput): Promise<void> {
      deps.state.save(key, input, sessionPath(windowId, key), now());
    },
    async externalOpen(_w: number, url: string): Promise<void> {
      const u = validateExternalUrl(url);
      await deps.openExternal(u.toString());
    },
  };
}

export type HostService = ReturnType<typeof createHostService>;
