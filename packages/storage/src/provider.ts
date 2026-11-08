import type { FileEntry } from "./host";

export interface ProjectRef {
  providerId: string;
  /** For local-fs: the project key. */
  key: string;
  displayName: string;
  displayPath?: string;
}

export interface ProviderCapabilities {
  pick: boolean;
  recents: boolean;
  offline: boolean;
  versions: boolean;
  watch: boolean;
}

export interface ProjectSession {
  readonly ref: ProjectRef;
  list(): Promise<FileEntry[]>;
  readText(name: string): Promise<{ content: string; version: string }>;
  /** Throws StorageError("conflict") when `ifVersion` no longer matches. */
  writeText(
    name: string,
    content: string,
    opts?: { ifVersion?: string },
  ): Promise<{ version: string }>;
  exists(name: string): Promise<boolean>;
  mediaUrl(name: string): Promise<string>;
  /** Last known version of a file read or written through this session. */
  versionOf(name: string): string | undefined;
  close(): Promise<void>;
}

export interface StorageProvider {
  /** "local-fs" | "google-drive" (future) | "web" (future) */
  readonly id: string;
  readonly capabilities: ProviderCapabilities;
  pickProject(): Promise<ProjectRef | null>;
  listRecent(): Promise<ProjectRef[]>;
  open(ref: ProjectRef): Promise<ProjectSession>;
  /** Opens the bundled sample (local provider only). */
  openSample?(): Promise<ProjectRef>;
  forget?(ref: ProjectRef): Promise<void>;
  /** Drops an authorized-but-unopened handle (cancel paths). */
  release?(ref: ProjectRef): Promise<void>;
}
