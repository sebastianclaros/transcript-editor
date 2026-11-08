import nodeFs from "node:fs/promises";
import path from "node:path";
import {
  StateFileSchema,
  defaultState,
  pruneState,
  type SessionState,
  type SessionStateInput,
  type StateFile,
} from "@transcript-editor/core";
import type { Fs } from "../fs/atomic";
import { backupCorrupt, readJsonFile, writeJsonAtomic } from "./atomicJson";
import type { StoreOptions } from "./config";

/** `state.json`: per-project session memory (position, speed), keyed by project key. Never in the project folder. */
export class StateStore {
  private state: StateFile = defaultState();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: Promise<void> = Promise.resolve();
  readonly file: string;
  private readonly fs: Fs;
  private readonly debounceMs: number;

  constructor(private readonly opts: StoreOptions) {
    this.file = path.join(opts.dir, "state.json");
    this.fs = opts.fs ?? nodeFs;
    this.debounceMs = opts.debounceMs ?? 500;
  }

  async load(): Promise<void> {
    const r = await readJsonFile(this.file, this.fs);
    if (r.kind === "absent") return;
    if (
      r.kind === "ok" &&
      typeof r.value === "object" &&
      r.value !== null &&
      !Array.isArray(r.value)
    ) {
      this.state = StateFileSchema.parse(r.value);
      return;
    }
    this.opts.log?.warn("state.json is damaged; starting empty");
    await backupCorrupt(this.file, this.fs);
    this.state = defaultState();
  }

  get(key: string): SessionState | null {
    return this.state.projects[key] ?? null;
  }

  /** Main fills `path`, `lastOpenedAt` and `updatedAt`; the renderer cannot inject them. */
  save(key: string, input: SessionStateInput, projectPath: string, now = new Date()): void {
    const iso = now.toISOString();
    const prev = this.state.projects[key];
    const entry: SessionState = {
      path: projectPath,
      lastOpenedAt: prev?.lastOpenedAt ?? iso,
      audioName: input.audioName,
      positionSec: input.positionSec,
      activeParagraphId: input.activeParagraphId,
      updatedAt: iso,
      ...(input.playbackRate !== undefined ? { playbackRate: input.playbackRate } : {}),
    };
    this.state = pruneState({ ...this.state, projects: { ...this.state.projects, [key]: entry } });
    this.schedule();
  }

  /** Marks the project as opened now (keeps LRU order for pruning). */
  touch(key: string, projectPath: string, now = new Date()): void {
    const prev = this.state.projects[key];
    if (!prev) return;
    this.state = {
      ...this.state,
      projects: {
        ...this.state.projects,
        [key]: { ...prev, path: projectPath, lastOpenedAt: now.toISOString() },
      },
    };
    this.schedule();
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.debounceMs);
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const text = JSON.stringify(this.state, null, 2) + "\n";
    this.pending = this.pending
      .then(() => writeJsonAtomic(this.file, text, this.fs))
      .catch((e) => this.opts.log?.error("could not write state.json", e));
    await this.pending;
  }
}
