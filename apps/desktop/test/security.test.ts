import { realpathSync, writeFileSync, mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { handleAppRequest } from "../src/main/appProtocol";
import { CloseProtocol, CLOSE_TIMEOUT_MS, shouldQuitOnAllClosed } from "../src/main/closeProtocol";
import { HostFault } from "../src/main/fault";
import { runHandler } from "../src/main/ipc/register";
import { buildMenuTemplate } from "../src/main/menu";
import { Registry } from "../src/main/registry";
import {
  assertTrustedSender,
  contentSecurityPolicy,
  isAllowedNavigation,
  isTrustedRendererUrl,
  shouldBlockRequest,
  validateExternalUrl,
} from "../src/main/security";
import { SCHEMAS } from "../src/shared/schemas";
import { CH } from "../src/shared/channels";
import { releaseUrl, updatesEnabled } from "../src/main/updates";
import { silentLog, tempDir } from "./helpers";

describe("isTrustedRendererUrl", () => {
  const prod = { devOrigin: null };
  it.each([
    ["app://renderer/index.html", true],
    ["app://renderer/", true],
    ["app://renderer", true],
    ["app://renderer.evil/", false],
    ["app://renderer@x/", false],
    ["app://user:pw@renderer/", false],
    ["app://renderer:8080/", false],
    ["app-media://renderer/", false],
    ["file:///x", false],
    ["https://renderer/", false],
    ["", false],
    ["garbage", false],
  ])("%j -> %s", (url, expected) => {
    expect(isTrustedRendererUrl(url, prod)).toBe(expected);
  });
  it("accepts the dev origin only in dev mode", () => {
    const dev = { devOrigin: "http://localhost:5173" };
    expect(isTrustedRendererUrl("http://localhost:5173/", dev)).toBe(true);
    expect(isTrustedRendererUrl("http://localhost:5174/", dev)).toBe(false);
    expect(isTrustedRendererUrl("http://localhost:5173.evil.com/", dev)).toBe(false);
    expect(isTrustedRendererUrl("http://localhost:5173/", prod)).toBe(false);
    expect(isTrustedRendererUrl("https://anything.test/", prod)).toBe(false);
  });
});

describe("assertTrustedSender", () => {
  const registry = new Registry();
  registry.addWindow(7);
  const main = {};
  const event = (over: Partial<{ id: number; frame: unknown; url: string }> = {}) => ({
    sender: { id: over.id ?? 7, mainFrame: main },
    senderFrame:
      over.frame === undefined
        ? ({ url: over.url ?? "app://renderer/index.html" } as object)
        : (over.frame as { url: string } | null),
  });
  it("accepts the main frame of a registered window at the renderer url", () => {
    const e = event();
    e.sender.mainFrame = e.senderFrame;
    expect(assertTrustedSender(e as never, registry, { devOrigin: null })).toBe(7);
  });
  it("rejects subframes, null frames, unknown windows and foreign urls", () => {
    const sub = event();
    expect(() => assertTrustedSender(sub as never, registry, { devOrigin: null })).toThrow(
      HostFault,
    );
    expect(() =>
      assertTrustedSender(event({ frame: null }) as never, registry, { devOrigin: null }),
    ).toThrow(HostFault);
    const unknown = event({ id: 99 });
    unknown.sender.mainFrame = unknown.senderFrame;
    expect(() => assertTrustedSender(unknown as never, registry, { devOrigin: null })).toThrow(
      HostFault,
    );
    const foreign = event({ url: "https://evil.example/" });
    foreign.sender.mainFrame = foreign.senderFrame;
    expect(() => assertTrustedSender(foreign as never, registry, { devOrigin: null })).toThrow(
      HostFault,
    );
  });
});

describe("external urls, request filter, csp, navigation", () => {
  it("validates external URLs", () => {
    expect(validateExternalUrl("https://github.com/x/y").hostname).toBe("github.com");
    for (const bad of [
      42,
      "",
      "x".repeat(2049),
      "http://a.b",
      "ftp://a.b",
      "https://u@a.b",
      "https://u:p@a.b",
      "nope",
    ]) {
      expect(() => validateExternalUrl(bad), String(bad)).toThrow(HostFault);
    }
  });
  it("blocks renderer requests to anything but our schemes", () => {
    for (const ok of [
      "app://renderer/a.js",
      "app-media://media/x/y.m4a",
      "data:image/png;base64,AA",
      "blob:app://renderer/1",
      "devtools://devtools/x",
    ]) {
      expect(shouldBlockRequest(ok, true, null), ok).toBe(false);
    }
    for (const bad of [
      "https://example.com/",
      "http://localhost:5173/",
      "ws://localhost:5173/",
      "file:///etc/passwd",
      "garbage",
    ]) {
      expect(shouldBlockRequest(bad, true, null), bad).toBe(true);
    }
    expect(shouldBlockRequest("https://example.com/", false, null)).toBe(false); // main-process requests (updater)
    expect(shouldBlockRequest("http://localhost:5173/x", true, "http://localhost:5173")).toBe(
      false,
    );
    expect(shouldBlockRequest("ws://localhost:5173/", true, "http://localhost:5173")).toBe(false);
    expect(shouldBlockRequest("http://localhost:9/", true, "http://localhost:5173")).toBe(true);
  });
  it("builds the production CSP without unsafe-inline and a relaxed dev CSP", () => {
    const prod = contentSecurityPolicy(false);
    expect(prod).toContain("default-src 'none'");
    expect(prod).toContain("media-src app-media:");
    expect(prod).not.toContain("unsafe-inline");
    expect(prod).toContain("object-src 'none'");
    expect(prod).toContain("frame-ancestors 'none'");
    expect(contentSecurityPolicy(true)).toContain("'unsafe-inline'");
  });
  it("only allows reloading the current url", () => {
    expect(isAllowedNavigation("app://renderer/index.html", "app://renderer/index.html")).toBe(
      true,
    );
    expect(isAllowedNavigation("https://evil.example/", "app://renderer/index.html")).toBe(false);
  });
  it("updates are on only when packaged and not disabled; release url", () => {
    expect(updatesEnabled({}, true)).toBe(true);
    expect(updatesEnabled({ TRANSCRIPT_EDITOR_DISABLE_UPDATE: "1" }, true)).toBe(false);
    expect(updatesEnabled({}, false)).toBe(false);
    expect(releaseUrl("0.1.0")).toBe(
      "https://github.com/sebastianclaros/transcript-editor/releases/tag/v0.1.0",
    );
  });
});

describe("IPC schemas and runHandler", () => {
  const registry = new Registry();
  registry.addWindow(1);
  const frame = { url: "app://renderer/index.html" };
  const event = { sender: { id: 1, mainFrame: frame }, senderFrame: frame } as never;
  const deps = { registry, trust: { devOrigin: null }, log: silentLog };
  const id = "a".repeat(32);

  it("rejects extra keys, bad ids and out-of-range values", () => {
    const s = SCHEMAS;
    expect(s[CH.settingsUpdate]!.safeParse([{ playbackRate: 1.5 }]).success).toBe(true);
    expect(s[CH.settingsUpdate]!.safeParse([{ lastProject: null }]).success).toBe(false);
    expect(s[CH.settingsUpdate]!.safeParse([{ playbackRate: 99 }]).success).toBe(false);
    expect(s[CH.projectClose]!.safeParse(["../../etc"]).success).toBe(false);
    expect(s[CH.projectClose]!.safeParse([id]).success).toBe(true);
    expect(s[CH.projectReadText]!.safeParse([id, ""]).success).toBe(false);
    expect(
      s[CH.projectWriteText]!.safeParse([id, "a.txt", "x", { ifVersion: "12.5:3" }]).success,
    ).toBe(true);
    expect(
      s[CH.projectWriteText]!.safeParse([id, "a.txt", "x", { ifVersion: "abc" }]).success,
    ).toBe(false);
    expect(
      s[CH.projectWriteText]!.safeParse([id, "a.txt", "x", { ifVersion: "1:1", extra: 1 }]).success,
    ).toBe(false);
    expect(
      s[CH.sessionSave]!.safeParse([
        id,
        { audioName: "a", positionSec: 1, activeParagraphId: null, path: "/etc" },
      ]).success,
    ).toBe(false);
    expect(s[CH.appGetInfo]!.safeParse(["unexpected"]).success).toBe(false);
    expect(s[CH.respondToClose]!.safeParse(["yes"]).success).toBe(false);
  });

  it("maps results and faults without throwing into IPC", async () => {
    const good = await runHandler(CH.appGetInfo, event, [], deps, async () => 5);
    expect(good).toEqual({ ok: true, value: 5 });
    const bad = await runHandler(CH.projectClose, event, ["nope"], deps, async () => 1);
    expect(bad).toMatchObject({ ok: false, error: { code: "invalid_argument" } });
    const fault = await runHandler(CH.appGetInfo, event, [], deps, async () => {
      throw new HostFault("conflict", "changed");
    });
    expect(fault).toMatchObject({ ok: false, error: { code: "conflict" } });
    const crash = await runHandler(CH.appGetInfo, event, [], deps, async () => {
      throw new Error("/secret/path leaked?");
    });
    expect(crash).toEqual({ ok: false, error: { code: "io_error", message: "internal error" } });
    const stranger = await runHandler(
      CH.appGetInfo,
      { sender: { id: 5, mainFrame: frame }, senderFrame: frame } as never,
      [],
      deps,
      async () => 1,
    );
    expect(stranger).toMatchObject({ ok: false, error: { code: "not_authorized" } });
  });
});

describe("CloseProtocol", () => {
  function fake(ready = true) {
    const calls: string[] = [];
    const timers: Array<{ fn: () => void; ms: number; cleared: boolean }> = [];
    const cp = new CloseProtocol({
      rendererReady: () => ready,
      sendCloseRequested: () => calls.push("send"),
      closeWindow: () => calls.push("close"),
      abortQuit: () => calls.push("abort"),
      setTimer: (fn, ms) => {
        const t = { fn, ms, cleared: false };
        timers.push(t);
        return t;
      },
      clearTimer: (t) => void ((t as { cleared: boolean }).cleared = true),
      log: { warn: () => calls.push("warn") },
    });
    return { cp, calls, timers };
  }
  it("closes at once when the renderer is not ready", () => {
    const { cp, calls } = fake(false);
    expect(cp.onWindowClose()).toBe(true);
    expect(calls).toEqual([]);
  });
  it("asks the renderer, then closes on true", () => {
    const { cp, calls, timers } = fake();
    expect(cp.onWindowClose()).toBe(false);
    expect(calls).toEqual(["send"]);
    expect(timers[0]?.ms).toBe(CLOSE_TIMEOUT_MS);
    expect(cp.respond(true)).toBe(true);
    expect(calls).toEqual(["send", "close"]);
    expect(timers[0]?.cleared).toBe(true);
    expect(cp.onWindowClose()).toBe(true); // approved
  });
  it("a false answer aborts the quit and keeps the window", () => {
    const { cp, calls } = fake();
    cp.onWindowClose();
    cp.respond(false);
    expect(calls).toEqual(["send", "abort"]);
    expect(cp.onWindowClose()).toBe(false); // asks again next time
    expect(calls.filter((c) => c === "send")).toHaveLength(2);
  });
  it("a dirty renderer announcing its dialog stops the timer; a human can take their time", () => {
    const { cp, timers, calls } = fake();
    cp.onWindowClose();
    expect(cp.dialogOpen(true)).toBe(true);
    expect(timers[0]?.cleared).toBe(true);
    expect(calls).not.toContain("close");
    cp.respond(true);
    expect(calls).toContain("close");
  });
  it("forces the close on timeout and when the renderer dies (even with the dialog open)", () => {
    const a = fake();
    a.cp.onWindowClose();
    a.timers[0]!.fn();
    expect(a.calls).toEqual(["send", "warn", "close"]);
    const b = fake();
    b.cp.onWindowClose();
    b.cp.dialogOpen(true);
    b.cp.rendererGone();
    expect(b.calls).toEqual(["send", "warn", "close"]);
  });
  it("rejects unsolicited answers", () => {
    const { cp, calls } = fake();
    expect(cp.respond(true)).toBe(false);
    expect(cp.dialogOpen(true)).toBe(false);
    cp.rendererGone();
    expect(calls).toEqual([]);
  });
  it("two fake windows keep independent state", () => {
    const a = fake();
    const b = fake();
    a.cp.onWindowClose();
    expect(a.cp.isPending).toBe(true);
    expect(b.cp.isPending).toBe(false);
    expect(b.cp.respond(true)).toBe(false);
  });
  it("quits on all-closed except on macOS", () => {
    expect(shouldQuitOnAllClosed("linux")).toBe(true);
    expect(shouldQuitOnAllClosed("win32")).toBe(true);
    expect(shouldQuitOnAllClosed("darwin")).toBe(false);
  });
});

describe("app:// protocol handler", () => {
  function renderer() {
    const root = realpathSync(tempDir());
    writeFileSync(join(root, "index.html"), "<html></html>");
    mkdirSync(join(root, "assets"));
    writeFileSync(join(root, "assets", "a.js"), "console.log(1)");
    const outside = realpathSync(tempDir());
    writeFileSync(join(outside, "secret.txt"), "secret");
    symlinkSync(join(outside, "secret.txt"), join(root, "assets", "leak.js"));
    return root;
  }
  const csp = "default-src 'none'";
  it("serves files with the CSP header and rejects traversal, symlinks and other methods", async () => {
    const root = renderer();
    const ok = await handleAppRequest({ method: "GET", url: "app://renderer/" }, root, csp);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("Content-Security-Policy")).toBe(csp);
    expect(ok.headers.get("Content-Type")).toContain("text/html");
    expect(
      (
        await handleAppRequest({ method: "GET", url: "app://renderer/assets/a.js" }, root, csp)
      ).headers.get("Content-Type"),
    ).toContain("javascript");
    expect(
      (await handleAppRequest({ method: "HEAD", url: "app://renderer/index.html" }, root, csp))
        .status,
    ).toBe(200);
    expect(
      (await handleAppRequest({ method: "POST", url: "app://renderer/" }, root, csp)).status,
    ).toBe(405);
    expect(
      (
        await handleAppRequest(
          { method: "GET", url: "app://renderer/%2e%2e/%2e%2e/etc/passwd" },
          root,
          csp,
        )
      ).status,
    ).toBe(404);
    expect(
      (await handleAppRequest({ method: "GET", url: "app://renderer/assets/leak.js" }, root, csp))
        .status,
    ).toBe(404);
    expect(
      (await handleAppRequest({ method: "GET", url: "app://renderer/nope.js" }, root, csp)).status,
    ).toBe(404);
    expect(
      (await handleAppRequest({ method: "GET", url: "app://evil/index.html" }, root, csp)).status,
    ).toBe(400);
    expect(
      (await handleAppRequest({ method: "GET", url: "app://renderer/a%00b" }, root, csp)).status,
    ).toBe(400);
    expect(
      (await handleAppRequest({ method: "GET", url: "app://renderer/assets" }, root, csp)).status,
    ).toBe(404);
  });
});

describe("application menu", () => {
  const base = {
    language: "es" as const,
    platform: "linux" as const,
    isPackaged: true,
    updatesEnabled: true,
    hasWindow: () => true,
    send: vi.fn(),
    openDocs: vi.fn(),
  };
  it("has no accelerator on Guardar and no menu item uses the playback hotkeys", () => {
    const tpl = buildMenuTemplate(base);
    const items = tpl.flatMap((m) => (Array.isArray(m.submenu) ? m.submenu : []));
    const save = items.find((i) => typeof i.label === "string" && i.label.startsWith("Guardar"));
    expect(save?.accelerator).toBeUndefined();
    expect(save?.label).toContain("Ctrl+S");
    const accelerators = items.map((i) => i.accelerator).filter(Boolean);
    expect(accelerators).toEqual(["CmdOrCtrl+O", "F1"]);
  });
  it("shows Cmd on macOS, hides dev tools when packaged and updates when disabled", () => {
    const mac = buildMenuTemplate({ ...base, platform: "darwin" });
    expect(JSON.stringify(mac)).toContain("Cmd+S");
    expect(JSON.stringify(buildMenuTemplate(base))).not.toContain("toggleDevTools");
    expect(JSON.stringify(buildMenuTemplate({ ...base, isPackaged: false }))).toContain(
      "toggleDevTools",
    );
    expect(JSON.stringify(buildMenuTemplate({ ...base, updatesEnabled: false }))).not.toContain(
      "actualizaciones",
    );
    expect(JSON.stringify(buildMenuTemplate({ ...base, language: "en" }))).toContain(
      "Open session folder",
    );
  });
  it("disables window-bound items without a window", () => {
    const items = buildMenuTemplate({ ...base, hasWindow: () => false }).flatMap((m) =>
      Array.isArray(m.submenu) ? m.submenu : [],
    );
    expect(items.find((i) => String(i.label).startsWith("Guardar"))?.enabled).toBe(false);
  });
});
