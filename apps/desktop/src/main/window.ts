import path from "node:path";
import { BrowserWindow, screen } from "electron";
import type { Config } from "@transcript-editor/core";
import { CloseProtocol } from "./closeProtocol";
import type { Registry } from "./registry";

export interface WindowDeps {
  registry: Registry;
  bounds: Config["window"];
  rendererUrl: string;
  /** Called (debounced by the caller's store) when bounds change. */
  onBounds(b: Config["window"]): void;
  closeProtocols: Map<number, CloseProtocol>;
  abortQuit(): void;
  log: { warn(...a: unknown[]): void };
}

function insideSomeDisplay(x: number, y: number): boolean {
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return x >= a.x && y >= a.y && x < a.x + a.width && y < a.y + a.height;
  });
}

/** Creates the single main window with the hardened webPreferences of design 5.1. */
export function createMainWindow(d: WindowDeps): BrowserWindow {
  const b = d.bounds;
  const placed = b.x !== undefined && b.y !== undefined && insideSomeDisplay(b.x, b.y);
  const win = new BrowserWindow({
    width: b.width,
    height: b.height,
    ...(placed ? { x: b.x, y: b.y } : {}),
    show: false,
    backgroundColor: "#0f1115",
    title: "Transcript Editor",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      spellcheck: true,
      preload: path.join(__dirname, "../preload/index.cjs"),
    },
  });
  const id = win.webContents.id;
  d.registry.addWindow(id);

  let loaded = false;
  let gone = false;
  const protocol = new CloseProtocol({
    rendererReady: () => loaded && !gone && !win.webContents.isDestroyed(),
    sendCloseRequested: () => win.webContents.send("host:event:close-requested"),
    closeWindow: () => win.close(),
    abortQuit: d.abortQuit,
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
    log: d.log,
  });
  d.closeProtocols.set(id, protocol);

  win.webContents.on("did-finish-load", () => {
    loaded = true;
  });
  win.webContents.on("render-process-gone", () => {
    gone = true;
    protocol.rendererGone();
  });
  win.on("unresponsive", () => protocol.rendererGone());
  win.once("ready-to-show", () => {
    if (b.maximized) win.maximize();
    win.show();
  });

  let boundsTimer: ReturnType<typeof setTimeout> | null = null;
  const saveBounds = () => {
    if (boundsTimer) clearTimeout(boundsTimer);
    boundsTimer = setTimeout(() => {
      if (win.isDestroyed()) return;
      const r = win.isMaximized() ? win.getNormalBounds() : win.getBounds();
      d.onBounds({
        width: r.width,
        height: r.height,
        x: r.x,
        y: r.y,
        maximized: win.isMaximized(),
      });
    }, 500);
  };
  win.on("resize", saveBounds);
  win.on("move", saveBounds);

  win.on("close", (event) => {
    if (!protocol.onWindowClose()) event.preventDefault();
  });
  win.on("closed", () => {
    d.registry.removeWindow(id);
    d.closeProtocols.delete(id);
  });

  void win.loadURL(d.rendererUrl);
  return win;
}
