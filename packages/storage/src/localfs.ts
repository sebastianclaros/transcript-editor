import { StorageError } from "./errors";
import type { HostApi, ProjectHandle, Result } from "./host";
import type { ProjectRef, ProjectSession, ProviderCapabilities, StorageProvider } from "./provider";

export const LOCAL_PROVIDER_ID = "local-fs";

function unwrap<T>(r: Result<T>): T {
  if (r.ok) return r.value;
  throw StorageError.fromHost(r.error);
}

/** Storage provider over the HostApi. One logical open never mints two project ids. */
export class LocalFsProvider implements StorageProvider {
  readonly id = LOCAL_PROVIDER_ID;
  readonly capabilities: ProviderCapabilities = {
    pick: true,
    recents: true,
    offline: true,
    versions: true,
    watch: false,
  };
  private readonly handles = new Map<string, ProjectHandle>();

  constructor(private readonly host: HostApi) {}

  private toRef(h: ProjectHandle): ProjectRef {
    this.handles.set(h.projectKey, h);
    return {
      providerId: this.id,
      key: h.projectKey,
      displayName: h.displayName,
      displayPath: h.displayPath,
    };
  }

  async pickProject(): Promise<ProjectRef | null> {
    const h = unwrap(await this.host.project.pickFolder());
    return h ? this.toRef(h) : null;
  }

  async openSample(): Promise<ProjectRef> {
    return this.toRef(unwrap(await this.host.project.openSample()));
  }

  async listRecent(): Promise<ProjectRef[]> {
    const s = unwrap(await this.host.settings.get());
    return s.recentProjects.map((r) => ({
      providerId: this.id,
      key: r.key,
      displayName: r.name,
      displayPath: r.path,
    }));
  }

  async open(ref: ProjectRef): Promise<ProjectSession> {
    if (ref.providerId !== this.id)
      throw new StorageError("invalid_argument", "foreign project ref");
    let handle = this.handles.get(ref.key);
    if (!handle) {
      handle = unwrap(await this.host.project.openRecent(ref.key));
      this.handles.set(handle.projectKey, handle);
    }
    return this.createSession(handle);
  }

  async forget(ref: ProjectRef): Promise<void> {
    await this.release(ref);
    unwrap(await this.host.recents.remove(ref.key));
  }

  async release(ref: ProjectRef): Promise<void> {
    const h = this.handles.get(ref.key);
    if (!h) return;
    this.handles.delete(ref.key);
    await this.host.project.close(h.projectId);
  }

  private createSession(handle: ProjectHandle): ProjectSession {
    const host = this.host;
    const id = handle.projectId;
    const versions = new Map<string, string>();
    const handles = this.handles;
    const ref: ProjectRef = {
      providerId: this.id,
      key: handle.projectKey,
      displayName: handle.displayName,
      displayPath: handle.displayPath,
    };
    return {
      ref,
      list: async () => unwrap(await host.project.listFiles(id)),
      async readText(name) {
        const f = unwrap(await host.project.readText(id, name));
        versions.set(name, f.version);
        return f;
      },
      async writeText(name, content, opts) {
        const r = unwrap(await host.project.writeText(id, name, content, opts));
        versions.set(name, r.version);
        return r;
      },
      exists: async (name) => unwrap(await host.project.exists(id, name)),
      mediaUrl: async (name) => unwrap(await host.project.mediaUrl(id, name)),
      versionOf: (name) => versions.get(name),
      async close() {
        handles.delete(handle.projectKey);
        unwrap(await host.project.close(id));
      },
    };
  }
}
