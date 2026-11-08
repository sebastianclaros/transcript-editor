import path from "node:path";
import {
  ConfigSchema,
  dedupeRecents,
  defaultConfig,
  parseConfig,
  serializeConfig,
  type Config,
  type RecentProject,
  type SettingsPatch,
} from "@transcript-editor/core";
import type { Fs } from "../fs/atomic";
import nodeFs from "node:fs/promises";
import { backupCorrupt, readJsonFile, writeJsonAtomic } from "./atomicJson";

export interface StoreOptions {
  dir: string;
  fs?: Fs;
  debounceMs?: number;
  log?: { warn(...a: unknown[]): void; info(...a: unknown[]): void; error(...a: unknown[]): void };
}

/**
 * `config.json`: local machine settings (not synced). Loaded tolerantly; a corrupt file is
 * backed up as `.bak` and replaced by defaults; a newer `version` and unknown keys survive.
 */
export class ConfigStore {
  private config: Config = defaultConfig();
  private recoveredFlag = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: Promise<void> = Promise.resolve();
  readonly file: string;
  private readonly fs: Fs;
  private readonly debounceMs: number;

  constructor(private readonly opts: StoreOptions) {
    this.file = path.join(opts.dir, "config.json");
    this.fs = opts.fs ?? nodeFs;
    this.debounceMs = opts.debounceMs ?? 500;
  }

  async load(): Promise<void> {
    const r = await readJsonFile(this.file, this.fs);
    if (r.kind === "absent") return;
    const parsed = r.kind === "ok" ? parseConfig(r.value) : null;
    if (parsed) {
      this.config = parsed;
      if (parsed.version > 1)
        this.opts.log?.info("config.json has a newer version", parsed.version);
      return;
    }
    this.opts.log?.warn("config.json is damaged; using defaults");
    await backupCorrupt(this.file, this.fs);
    this.config = defaultConfig();
    this.recoveredFlag = true;
  }

  get(): Config {
    return this.config;
  }

  /** True once after a recovery: the UI shows a toast. */
  takeRecovered(): boolean {
    const v = this.recoveredFlag;
    this.recoveredFlag = false;
    return v;
  }

  update(patch: SettingsPatch): Config {
    return this.set({ ...this.config, ...patch });
  }

  /** Records a successfully opened project at the top of the recents and as the last project. */
  touchProject(entry: RecentProject): Config {
    return this.set({
      ...this.config,
      lastProject: entry,
      recentProjects: dedupeRecents([entry, ...this.config.recentProjects]),
    });
  }

  removeRecent(key: string): Config {
    return this.set({
      ...this.config,
      recentProjects: this.config.recentProjects.filter((r) => r.key !== key),
      lastProject: this.config.lastProject?.key === key ? null : this.config.lastProject,
    });
  }

  clearRecents(): Config {
    return this.set({ ...this.config, recentProjects: [], lastProject: null });
  }

  setWindow(bounds: Config["window"]): void {
    this.set({ ...this.config, window: ConfigSchema.shape.window.parse(bounds) });
  }

  private set(next: Config): Config {
    this.config = next;
    this.schedule();
    return next;
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.debounceMs);
  }

  /** Writes now (also called on before-quit). */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const text = serializeConfig(this.config);
    this.pending = this.pending
      .then(() => writeJsonAtomic(this.file, text, this.fs))
      .catch((e) => this.opts.log?.error("could not write config.json", e));
    await this.pending;
  }
}
