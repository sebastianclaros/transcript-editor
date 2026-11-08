import { StorageError } from "../errors";
import type { StorageProvider } from "../provider";

const MESSAGE = "Google Drive support is planned: see docs/drive-sync-design.md";

/**
 * Placeholder that pins the provider shape for the future Google Drive provider.
 * Not wired into the UI in v0.1: every method rejects with `unsupported`.
 */
export function createGoogleDriveProvider(): StorageProvider {
  const fail = async (): Promise<never> => {
    throw new StorageError("unsupported", MESSAGE);
  };
  return {
    id: "google-drive",
    capabilities: { pick: false, recents: false, offline: false, versions: false, watch: false },
    pickProject: fail,
    listRecent: fail,
    open: fail,
  };
}
