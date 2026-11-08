import {
  defaultConfig,
  dedupeRecents,
  fileKindOf,
  validateFileName,
  type SessionState,
} from "@transcript-editor/core";
import {
  MAX_LIST,
  type FileEntry,
  type HostApi,
  type HostError,
  type HostErrorCode,
  type MenuCommand,
  type ProjectHandle,
  type Result,
  type SettingsView,
  type UpdateStatus,
} from "../host";

export interface MemoryFile {
  content: string;
  mtimeMs: number;
}

export interface MemoryHostOptions {
  /** Folder display name (default "sesion-demo"). */
  folderName?: string;
  platform?: HostApi["platform"];
  /** Initial settings overrides. */
  settings?: Partial<SettingsView>;
  language?: "es" | "en";
}

export interface MemoryHost extends HostApi {
  /** Test access to the in-memory folder. */
  readonly files: Map<string, MemoryFile>;
  readonly handle: ProjectHandle;
  readonly sessions: Map<string, SessionState>;
  /** Every call as `"area.method"`, in order. */
  readonly calls: string[];
  /** Next `pickFolder` returns this (null = cancelled; "error" = invalid_argument). */
  pickResult: "project" | "cancel" | "error";
  /** Recorded `session.save` payloads. */
  readonly savedSessions: Array<{ key: string; state: unknown }>;
  readonly opened: string[];
  readonly closedIds: string[];
  settingsView(): SettingsView;
  setSettings(s: Partial<SettingsView>): void;
  emitMenu(c: MenuCommand): void;
  emitCloseRequested(): void;
  emitUpdate(s: UpdateStatus): void;
  readonly closeResponses: boolean[];
  /** Simulates an external edit (changes the version). */
  touch(name: string, content: string): void;
  deleteFile(name: string): void;
}

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (code: HostErrorCode, message: string): Result<never> => ({
  ok: false,
  error: { code, message } satisfies HostError,
});

/**
 * In-memory HostApi for tests (and a future web stub). Honours the version / conflict semantics
 * of the real host: see docs/architecture.md.
 */
export function createMemoryHost(
  initial: Record<string, string>,
  opts: MemoryHostOptions = {},
): MemoryHost {
  const files = new Map<string, MemoryFile>();
  let clock = 1_700_000_000_000;
  for (const [name, content] of Object.entries(initial))
    files.set(name, { content, mtimeMs: clock++ });
  const folderName = opts.folderName ?? "sesion-demo";
  const handle: ProjectHandle = {
    projectId: "a".repeat(32),
    projectKey: "b".repeat(32),
    displayName: folderName,
    displayPath: `/tmp/${folderName}`,
  };
  let settings: SettingsView = {
    ...defaultConfig(),
    language: opts.language ?? "es",
    recovered: false,
    ...opts.settings,
  };
  const calls: string[] = [];
  const sessions = new Map<string, SessionState>();
  const menuCbs = new Set<(c: MenuCommand) => void>();
  const closeCbs = new Set<() => void>();
  const updateCbs = new Set<(s: UpdateStatus) => void>();
  const versionOf = (f: MemoryFile) => `${f.mtimeMs}:${f.content.length}`;

  const pushRecent = () => {
    const entry = {
      key: handle.projectKey,
      path: handle.displayPath,
      name: handle.displayName,
      lastOpenedAt: new Date(clock++).toISOString(),
    };
    settings = {
      ...settings,
      lastProject: entry,
      recentProjects: dedupeRecents([entry, ...settings.recentProjects]),
    };
  };

  const checkProject = (projectId: string): Result<never> | null =>
    projectId === handle.projectId ? null : fail("not_authorized", "unknown project");
  const checkName = (name: string): Result<never> | null =>
    validateFileName(name).ok ? null : fail("invalid_name", "invalid file name");

  const host: MemoryHost = {
    platform: opts.platform ?? "linux",
    files,
    handle,
    sessions,
    calls,
    pickResult: "project",
    savedSessions: [],
    opened: [],
    closedIds: [],
    closeResponses: [],
    settingsView: () => settings,
    setSettings(s) {
      settings = { ...settings, ...s };
    },
    emitMenu: (c) => menuCbs.forEach((cb) => cb(c)),
    emitCloseRequested: () => closeCbs.forEach((cb) => cb()),
    emitUpdate: (s) => updateCbs.forEach((cb) => cb(s)),
    touch(name, content) {
      files.set(name, { content, mtimeMs: clock++ });
    },
    deleteFile(name) {
      files.delete(name);
    },
    app: {
      async getInfo() {
        calls.push("app.getInfo");
        return ok({
          name: "Transcript Editor",
          version: "0.0.0-test",
          platform: opts.platform ?? "linux",
          locale: settings.language,
          isPackaged: false,
        });
      },
    },
    settings: {
      async get() {
        calls.push("settings.get");
        const view = settings;
        settings = { ...settings, recovered: false };
        return ok(view);
      },
      async update(patch) {
        calls.push("settings.update");
        settings = { ...settings, ...patch };
        return ok(settings);
      },
    },
    recents: {
      async remove(key) {
        calls.push("recents.remove");
        settings = {
          ...settings,
          recentProjects: settings.recentProjects.filter((r) => r.key !== key),
          lastProject: settings.lastProject?.key === key ? null : settings.lastProject,
        };
        return ok(settings);
      },
      async clear() {
        calls.push("recents.clear");
        settings = { ...settings, recentProjects: [], lastProject: null };
        return ok(settings);
      },
    },
    project: {
      async pickFolder() {
        calls.push("project.pickFolder");
        if (host.pickResult === "cancel") return ok(null);
        if (host.pickResult === "error") return fail("invalid_argument", "folder not allowed");
        host.opened.push(handle.projectKey);
        pushRecent();
        return ok(handle);
      },
      async openRecent(key) {
        calls.push("project.openRecent");
        if (key !== handle.projectKey) return fail("not_found", "unknown recent project");
        host.opened.push(key);
        pushRecent();
        return ok(handle);
      },
      async openSample() {
        calls.push("project.openSample");
        host.opened.push(handle.projectKey);
        pushRecent();
        return ok(handle);
      },
      async close(projectId) {
        calls.push("project.close");
        const bad = checkProject(projectId);
        if (bad) return bad;
        host.closedIds.push(projectId);
        return ok(undefined);
      },
      async listFiles(projectId) {
        calls.push("project.listFiles");
        const bad = checkProject(projectId);
        if (bad) return bad;
        const list: FileEntry[] = [...files.entries()]
          .filter(([n]) => !n.startsWith("."))
          .map(([name, f]) => ({
            name,
            kind: fileKindOf(name),
            size: f.content.length,
            mtimeMs: f.mtimeMs,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        return ok(list.slice(0, MAX_LIST));
      },
      async readText(projectId, name) {
        calls.push("project.readText");
        const bad = checkProject(projectId) ?? checkName(name);
        if (bad) return bad;
        if (!/\.(txt|json)$/i.test(name)) return fail("invalid_name", "only .txt and .json");
        const f = files.get(name);
        if (!f) return fail("not_found", "no such file");
        return ok({ content: f.content, version: versionOf(f) });
      },
      async writeText(projectId, name, content, o) {
        calls.push("project.writeText");
        const bad = checkProject(projectId) ?? checkName(name);
        if (bad) return bad;
        if (!/\.(txt|json)$/i.test(name)) return fail("invalid_name", "only .txt and .json");
        const cur = files.get(name);
        if (o?.ifVersion !== undefined) {
          if (!cur) return fail("conflict", "file was deleted");
          if (versionOf(cur) !== o.ifVersion) return fail("conflict", "file changed on disk");
        }
        const next: MemoryFile = { content, mtimeMs: clock++ };
        files.set(name, next);
        return ok({ version: versionOf(next) });
      },
      async exists(projectId, name) {
        calls.push("project.exists");
        const bad = checkProject(projectId) ?? checkName(name);
        if (bad) return bad;
        return ok(files.has(name));
      },
      async mediaUrl(projectId, name) {
        calls.push("project.mediaUrl");
        const bad = checkProject(projectId) ?? checkName(name);
        if (bad) return bad;
        if (!files.has(name)) return fail("not_found", "no such file");
        return ok(`memory://media/${projectId}/${encodeURIComponent(name)}`);
      },
    },
    session: {
      async get(key) {
        calls.push("session.get");
        return ok(sessions.get(key) ?? null);
      },
      async save(key, state) {
        calls.push("session.save");
        host.savedSessions.push({ key, state });
        const now = new Date(clock++).toISOString();
        sessions.set(key, {
          path: handle.displayPath,
          lastOpenedAt: now,
          updatedAt: now,
          ...state,
        });
        return ok(undefined);
      },
    },
    external: {
      async open() {
        calls.push("external.open");
        return ok(undefined);
      },
    },
    updates: {
      async check() {
        calls.push("updates.check");
        return ok(undefined);
      },
      onStatus(cb) {
        updateCbs.add(cb);
        return () => updateCbs.delete(cb);
      },
    },
    lifecycle: {
      onMenuCommand(cb) {
        menuCbs.add(cb);
        return () => menuCbs.delete(cb);
      },
      onCloseRequested(cb) {
        closeCbs.add(cb);
        return () => closeCbs.delete(cb);
      },
      async closeDialogOpen() {
        calls.push("lifecycle.closeDialogOpen");
        return ok(undefined);
      },
      async respondToClose(allow) {
        calls.push("lifecycle.respondToClose");
        host.closeResponses.push(allow);
        return ok(undefined);
      },
    },
  };
  return host;
}
