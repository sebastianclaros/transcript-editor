import { BRAND } from "@transcript-editor/core";
import type { UpdateStatus } from "@transcript-editor/storage";

export function updatesEnabled(env: NodeJS.ProcessEnv, isPackaged: boolean): boolean {
  return isPackaged && env.TRANSCRIPT_EDITOR_DISABLE_UPDATE !== "1";
}

/** Release page URL built from the tag (UpdateInfo has no page URL). */
export function releaseUrl(version: string): string {
  return `https://github.com/${BRAND.repo}/releases/tag/v${version}`;
}

/**
 * Notify-only update check: never downloads or installs (builds are unsigned in v0.1).
 * The only network call the app can make, and only when the user asks for it.
 */
export async function checkForUpdates(
  emit: (s: UpdateStatus) => void,
  log: { warn(...a: unknown[]): void },
) {
  emit({ state: "checking" });
  try {
    const { autoUpdater } = await import("electron-updater");
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.allowPrerelease = false;
    const result = await autoUpdater.checkForUpdates();
    const info = result?.updateInfo;
    if (info && result?.isUpdateAvailable)
      emit({ state: "available", version: info.version, url: releaseUrl(info.version) });
    else emit({ state: "none" });
  } catch (e) {
    log.warn("update check failed", (e as Error).message);
    emit({ state: "error", message: "update check failed" });
  }
}
