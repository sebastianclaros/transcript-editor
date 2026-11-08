import { randomBytes } from "node:crypto";

export interface AuthorizedProject {
  projectId: string;
  projectKey: string;
  root: string;
  displayName: string;
  windowId: number;
}

interface WindowCtx {
  projects: Map<string, AuthorizedProject>;
  pendingClose: { timer: unknown; dialogOpen: boolean } | null;
}

/**
 * Per-window authorization state plus a global lookup by project id (used by the media protocol).
 * The unguessable 128-bit project id is the capability.
 */
export class Registry {
  private readonly windows = new Map<number, WindowCtx>();

  addWindow(id: number): void {
    if (!this.windows.has(id)) this.windows.set(id, { projects: new Map(), pendingClose: null });
  }
  removeWindow(id: number): void {
    this.windows.delete(id);
  }
  hasWindow(id: number): boolean {
    return this.windows.has(id);
  }

  addProject(
    windowId: number,
    p: { root: string; key: string; displayName: string },
  ): AuthorizedProject {
    const ctx = this.windows.get(windowId);
    if (!ctx) throw new Error("unknown window");
    const project: AuthorizedProject = {
      projectId: randomBytes(16).toString("hex"),
      projectKey: p.key,
      root: p.root,
      displayName: p.displayName,
      windowId,
    };
    ctx.projects.set(project.projectId, project);
    return project;
  }

  /** Project of THIS window only: an id registered by window A is unknown to window B. */
  getProject(windowId: number, projectId: string): AuthorizedProject | undefined {
    return this.windows.get(windowId)?.projects.get(projectId);
  }

  /** Union over windows, for the `app-media` protocol (no window context in requests). */
  findProject(projectId: string): AuthorizedProject | undefined {
    for (const ctx of this.windows.values()) {
      const p = ctx.projects.get(projectId);
      if (p) return p;
    }
    return undefined;
  }

  closeProject(windowId: number, projectId: string): boolean {
    return this.windows.get(windowId)?.projects.delete(projectId) ?? false;
  }

  /** Root of an authorized project of this window, by its key. */
  rootOfKey(windowId: number, key: string): string | undefined {
    for (const p of this.windows.get(windowId)?.projects.values() ?? [])
      if (p.projectKey === key) return p.root;
    return undefined;
  }

  /** Keys of the projects authorized in this window. */
  keysOf(windowId: number): Set<string> {
    const ctx = this.windows.get(windowId);
    return new Set([...(ctx?.projects.values() ?? [])].map((p) => p.projectKey));
  }

  ctx(windowId: number): WindowCtx | undefined {
    return this.windows.get(windowId);
  }
}
