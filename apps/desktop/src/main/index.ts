import path from "node:path";
import {
  BrowserWindow,
  Menu,
  app,
  dialog,
  ipcMain,
  protocol,
  session,
  shell,
  type WebContents,
} from "electron";
import log from "electron-log/main";
import { BRAND, languageFromLocale, type Language } from "@transcript-editor/core";
import type { AppInfo, MenuCommand, UpdateStatus } from "@transcript-editor/storage";
import { handleAppRequest } from "./appProtocol";
import type { CloseProtocol } from "./closeProtocol";
import { shouldQuitOnAllClosed } from "./closeProtocol";
import { createHostService } from "./host/service";
import { registerIpc } from "./ipc/register";
import { handleMediaRequest } from "./media/handler";
import { installMenu } from "./menu";
import { Registry } from "./registry";
import {
  contentSecurityPolicy,
  isAllowedNavigation,
  shouldBlockRequest,
  validateExternalUrl,
  type TrustCtx,
} from "./security";
import { ConfigStore } from "./store/config";
import { StateStore } from "./store/state";
import { checkForUpdates, updatesEnabled } from "./updates";
import { createMainWindow } from "./window";

const SMOKE = process.argv.includes("--smoke-test");
const E2E = process.env.TRANSCRIPT_EDITOR_E2E === "1" && !app.isPackaged;

// The custom schemes must be registered before `ready`.
protocol.registerSchemesAsPrivileged([
  {
    scheme: BRAND.protocols.app,
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
  {
    scheme: BRAND.protocols.media,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  void main();
}

async function main(): Promise<void> {
  log.initialize();
  log.transports.file.maxSize = 1024 * 1024;
  log.transports.console.level = app.isPackaged ? "warn" : "info";
  const logger = { info: log.info, warn: log.warn, error: log.error };

  // Renderer URL rule: dev server only when unpackaged AND ELECTRON_RENDERER_URL is set.
  const devUrl = !app.isPackaged ? process.env.ELECTRON_RENDERER_URL : undefined;
  const rendererUrl = devUrl ?? `${BRAND.protocols.app}://renderer/index.html`;
  const trust: TrustCtx = { devOrigin: devUrl ? new URL(devUrl).origin : null };
  const csp = contentSecurityPolicy(trust.devOrigin !== null, BRAND.protocols.media);

  const registry = new Registry();
  const closeProtocols = new Map<number, CloseProtocol>();
  let mainWindow: BrowserWindow | null = null;
  let quitting = false;

  await app.whenReady();
  const userData = app.getPath("userData");
  const config = new ConfigStore({ dir: userData, log: logger });
  const state = new StateStore({ dir: userData, log: logger });
  await config.load();
  await state.load();

  let language: Language = config.get().language ?? languageFromLocale(app.getLocale());

  const sampleDir = app.isPackaged
    ? path.join(process.resourcesPath, "samples", "demo-session")
    : path.join(app.getAppPath(), "..", "..", "samples", "demo-session");

  const info = (): AppInfo => ({
    name: BRAND.productName,
    version: app.getVersion(),
    platform:
      process.platform === "darwin" || process.platform === "win32" ? process.platform : "linux",
    locale: app.getLocale(),
    isPackaged: app.isPackaged,
  });

  const service = createHostService({
    registry,
    config,
    state,
    paths: { userData, logs: app.getPath("logs"), documents: app.getPath("documents"), sampleDir },
    pickFolderDialog: async (windowId) => {
      const win = BrowserWindow.getAllWindows().find((w) => w.webContents.id === windowId);
      const opts = { properties: ["openDirectory" as const] };
      const r = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
      return r.canceled || r.filePaths.length === 0 ? null : (r.filePaths[0] ?? null);
    },
    appInfo: info,
    openExternal: (url) => shell.openExternal(url),
    devOpenDir: !app.isPackaged ? (process.env.TRANSCRIPT_EDITOR_DEV_OPEN ?? null) : null,
  });

  const emitUpdate = (s: UpdateStatus) =>
    mainWindow?.webContents.send("host:event:update-status", s);
  registerIpc({
    ipcMain,
    registry,
    trust,
    service,
    closeProtocolOf: (id) => closeProtocols.get(id),
    checkUpdates: async () => {
      if (!updatesEnabled(process.env, app.isPackaged)) throw new Error("updates disabled");
      void checkForUpdates(emitUpdate, log);
    },
    log: logger,
  });

  // --- custom protocols ---
  const stats = { 200: 0, 206: 0, 416: 0, other: 0 };
  if (E2E) (globalThis as Record<string, unknown>).__mediaStats = stats;
  protocol.handle(BRAND.protocols.media, (request) =>
    handleMediaRequest(request, {
      registry,
      trust,
      log,
      onResponse: E2E
        ? (code) => {
            if (code === 200 || code === 206 || code === 416) stats[code]++;
            else stats.other++;
          }
        : undefined,
    }),
  );
  const rendererRoot = path.join(__dirname, "../renderer");
  protocol.handle(BRAND.protocols.app, (request) => handleAppRequest(request, rendererRoot, csp));

  // --- security hardening for every webContents ---
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  ses.setPermissionCheckHandler(() => false);
  ses.webRequest.onBeforeRequest((details, cb) => {
    const block = shouldBlockRequest(
      details.url,
      details.webContentsId !== undefined,
      trust.devOrigin,
    );
    if (block) logger.warn("blocked renderer request", new URL(details.url).protocol);
    cb({ cancel: block });
  });
  if (trust.devOrigin !== null) {
    ses.webRequest.onHeadersReceived((details, cb) => {
      cb({ responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": [csp] } });
    });
  }
  app.on("web-contents-created", (_e, wc: WebContents) => {
    wc.on("will-navigate", (e, url) => {
      if (!isAllowedNavigation(url, wc.getURL())) e.preventDefault();
    });
    wc.on("will-redirect", (e) => e.preventDefault());
    wc.on("will-attach-webview", (e) => e.preventDefault());
    wc.setWindowOpenHandler(({ url }) => {
      try {
        void shell.openExternal(validateExternalUrl(url).toString());
      } catch {
        logger.warn("window.open denied");
      }
      return { action: "deny" };
    });
  });

  const sendMenu = (command: MenuCommand) => {
    const wins = BrowserWindow.getAllWindows();
    if (command === "open-folder" && wins.length === 0) openWindow();
    for (const w of BrowserWindow.getAllWindows())
      w.webContents.send("host:event:menu-command", command);
  };
  const rebuildMenu = () =>
    installMenu({
      language,
      platform: process.platform,
      isPackaged: app.isPackaged,
      updatesEnabled: updatesEnabled(process.env, app.isPackaged),
      hasWindow: () => BrowserWindow.getAllWindows().length > 0,
      send: sendMenu,
      openDocs: () => void shell.openExternal(`https://github.com/${BRAND.repo}#readme`),
    });

  const openWindow = () => {
    mainWindow = createMainWindow({
      registry,
      bounds: config.get().window,
      rendererUrl,
      onBounds: (b) => config.setWindow(b),
      closeProtocols,
      abortQuit: () => {
        quitting = false;
      },
      log,
    });
    mainWindow.on("closed", () => {
      mainWindow = null;
      rebuildMenu();
    });
    rebuildMenu();
    if (SMOKE) runSmoke(mainWindow);
    return mainWindow;
  };

  // Keep the application menu language in sync with the settings.
  setInterval(() => {
    const next = config.get().language;
    if (next !== language) {
      language = next;
      rebuildMenu();
    }
  }, 1000).unref();

  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.on("window-all-closed", () => {
    if (shouldQuitOnAllClosed(process.platform)) app.quit();
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) openWindow();
  });
  app.on("before-quit", (e) => {
    if (quitting) return;
    // Every window goes through the close-request protocol; re-issue quit once all are approved.
    const open = BrowserWindow.getAllWindows();
    if (open.length > 0) {
      e.preventDefault();
      quitting = true;
      let remaining = open.length;
      for (const w of open) {
        w.once("closed", () => {
          remaining--;
          if (remaining === 0) {
            void Promise.all([config.flush(), state.flush()]).finally(() => app.quit());
          }
        });
        w.close();
      }
      return;
    }
    e.preventDefault();
    quitting = true;
    void Promise.all([config.flush(), state.flush()]).finally(() => app.quit());
  });

  Menu.setApplicationMenu(null);
  openWindow();
}

/** `--smoke-test`: prove the packaged app boots and `window.host` exists, then exit. */
function runSmoke(win: BrowserWindow): void {
  const fatal = (msg: string) => {
    console.error(`TRANSCRIPT_EDITOR_SMOKE_FAILED: ${msg}`);
    app.exit(1);
  };
  const timer = setTimeout(() => fatal("timeout"), 30_000);
  win.webContents.on("render-process-gone", (_e, d) => fatal(`renderer gone (${d.reason})`));
  win.webContents.on("did-fail-load", (_e, code, desc) => fatal(`load failed ${code} ${desc}`));
  win.webContents.on("did-finish-load", () => {
    win.webContents
      .executeJavaScript(
        "typeof window.host === 'object' && typeof window.host.app.getInfo === 'function' && document.getElementById('root') !== null",
      )
      .then((okay) => {
        clearTimeout(timer);
        if (okay) {
          console.log("TRANSCRIPT_EDITOR_READY");
          app.exit(0);
        } else fatal("window.host missing");
      })
      .catch((e: Error) => fatal(e.message));
  });
}
