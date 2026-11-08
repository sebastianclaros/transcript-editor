import { mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HostFault } from "../src/main/fault";
import { ensureSample } from "../src/main/host/sample";
import { createHostService } from "../src/main/host/service";
import { Registry } from "../src/main/registry";
import { ConfigStore } from "../src/main/store/config";
import { StateStore } from "../src/main/store/state";
import { silentLog, tempDir } from "./helpers";

async function setup(opts: { devOpenDir?: string | null } = {}) {
  const userData = realpathSync(tempDir("te-ud-"));
  const project = realpathSync(tempDir("te-proj-"));
  writeFileSync(join(project, "unido.txt"), "A: hola\n");
  writeFileSync(join(project, "unido.mp4"), "video");
  const sample = realpathSync(tempDir("te-sample-"));
  writeFileSync(join(sample, "demo.txt"), "A: demo\n");
  writeFileSync(join(sample, "demo.m4a"), "aud");
  const docs = realpathSync(tempDir("te-docs-"));
  const registry = new Registry();
  registry.addWindow(1);
  registry.addWindow(2);
  const config = new ConfigStore({ dir: userData, debounceMs: 0, log: silentLog });
  const state = new StateStore({ dir: userData, debounceMs: 0, log: silentLog });
  await config.load();
  await state.load();
  let dialogResult: string | null = project;
  const opened: string[] = [];
  const service = createHostService({
    registry,
    config,
    state,
    paths: { userData, logs: join(userData, "logs"), documents: docs, sampleDir: sample },
    pickFolderDialog: async () => dialogResult,
    appInfo: () => ({
      name: "t",
      version: "0",
      platform: "linux",
      locale: "es",
      isPackaged: false,
    }),
    openExternal: async (u) => void opened.push(u),
    devOpenDir: opts.devOpenDir ?? null,
  });
  return {
    service,
    registry,
    config,
    state,
    userData,
    project,
    sample,
    docs,
    opened,
    setDialog: (v: string | null) => (dialogResult = v),
  };
}

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof HostFault ? e.code : `other:${String(e)}`;
  }
};

describe("host service", () => {
  it("opens a folder through the dialog result, adds recents and lets files be read/written", async () => {
    const t = await setup();
    const h = (await t.service.pickFolder(1))!;
    expect(h.projectId).toMatch(/^[0-9a-f]{32}$/);
    expect(h.displayPath).toBe(t.project);
    expect(t.config.get().recentProjects[0]?.key).toBe(h.projectKey);
    expect((await t.service.listFiles(1, h.projectId)).map((f) => f.name)).toEqual([
      "unido.mp4",
      "unido.txt",
    ]);
    const read = await t.service.readText(1, h.projectId, "unido.txt");
    const w = await t.service.writeText(1, h.projectId, "unido.txt", "A: chau\n", {
      ifVersion: read.version,
    });
    expect(w.version).not.toBe(read.version);
    expect(
      await code(
        t.service.writeText(1, h.projectId, "unido.txt", "x", { ifVersion: read.version }),
      ),
    ).toBe("conflict");
    expect(await t.service.exists(1, h.projectId, "unido.txt")).toBe(true);
    expect(await t.service.exists(1, h.projectId, "nuevo.json")).toBe(false);
    expect(await t.service.mediaUrl(1, h.projectId, "unido.mp4")).toBe(
      `app-media://media/${h.projectId}/unido.mp4`,
    );
    expect(await code(t.service.mediaUrl(1, h.projectId, "../x.mp4"))).toBe("invalid_name");
  });

  it("returns null when the dialog is cancelled and rejects unusable folders", async () => {
    const t = await setup();
    t.setDialog(null);
    expect(await t.service.pickFolder(1)).toBeNull();
    t.setDialog(t.userData);
    expect(await code(t.service.pickFolder(1))).toBe("invalid_argument");
  });

  it("projects are scoped to the window that opened them", async () => {
    const t = await setup();
    const h = (await t.service.pickFolder(1))!;
    expect(await code(t.service.listFiles(2, h.projectId))).toBe("not_authorized");
    expect(await code(t.service.closeProject(2, h.projectId))).toBe("not_authorized");
    await t.service.closeProject(1, h.projectId);
    expect(await code(t.service.listFiles(1, h.projectId))).toBe("not_authorized");
  });

  it("openRecent resolves the path from main's own recents", async () => {
    const t = await setup();
    const first = (await t.service.pickFolder(1))!;
    const again = await t.service.openRecent(1, first.projectKey);
    expect(again.projectKey).toBe(first.projectKey);
    expect(again.projectId).not.toBe(first.projectId);
    expect(await code(t.service.openRecent(1, "c".repeat(32)))).toBe("not_found");
  });

  it("session get/save accept only authorized or recent keys and never write into the project folder", async () => {
    const t = await setup();
    const before = readdirSync(t.project).sort();
    expect(await code(t.service.sessionGet(1, "d".repeat(32)))).toBe("not_authorized");
    expect(
      await code(
        t.service.sessionSave(1, "d".repeat(32), {
          audioName: "a",
          positionSec: 1,
          activeParagraphId: null,
        }),
      ),
    ).toBe("not_authorized");
    const h = (await t.service.pickFolder(1))!;
    await t.service.sessionSave(1, h.projectKey, {
      audioName: "unido.mp4",
      positionSec: 42,
      activeParagraphId: 5,
      playbackRate: 1.5,
    });
    expect(await t.service.sessionGet(1, h.projectKey)).toMatchObject({
      audioName: "unido.mp4",
      positionSec: 42,
      path: t.project,
    });
    await t.state.flush();
    expect(
      JSON.parse(readFileSync(join(t.userData, "state.json"), "utf8")).projects[h.projectKey]
        .positionSec,
    ).toBe(42);
    expect(readdirSync(t.project).sort()).toEqual(before);
    // a recent key is accepted even from a window that has not opened it
    expect(await t.service.sessionGet(2, h.projectKey)).not.toBeNull();
  });

  it("settings update is validated by schema upstream; service applies and returns the view", async () => {
    const t = await setup();
    const v = await t.service.settingsUpdate(1, { playbackRate: 2, language: "en" });
    expect(v).toMatchObject({ playbackRate: 2, language: "en", recovered: false });
    expect(await t.service.recentsClear()).toMatchObject({ recentProjects: [] });
  });

  it("external links must be https without credentials", async () => {
    const t = await setup();
    await t.service.externalOpen(1, "https://github.com/sebastianclaros/transcript-editor");
    expect(t.opened).toEqual(["https://github.com/sebastianclaros/transcript-editor"]);
    for (const bad of [
      "http://x.org",
      "file:///etc/passwd",
      "javascript:alert(1)",
      "https://u:p@x.org",
      "nonsense",
      "https://",
    ]) {
      expect(await code(t.service.externalOpen(1, bad)), bad).toBe("invalid_argument");
    }
  });

  it("dev override opens TRANSCRIPT_EDITOR_DEV_OPEN without a dialog", async () => {
    const proj = realpathSync(tempDir());
    const t = await setup({ devOpenDir: proj });
    t.setDialog(null);
    expect((await t.service.pickFolder(1))?.displayPath).toBe(proj);
  });

  it("opens the sample by copying it into Documents without overwriting edits", async () => {
    const t = await setup();
    const h = await t.service.openSample(1);
    expect(h.displayName).toBe("Transcript Editor Demo");
    writeFileSync(join(h.displayPath, "demo.txt"), "A: editado por el usuario\n");
    await t.service.openSample(1);
    expect(readFileSync(join(h.displayPath, "demo.txt"), "utf8")).toBe(
      "A: editado por el usuario\n",
    );
  });
});

describe("ensureSample", () => {
  it("copies missing files only and skips a non-directory in the way", async () => {
    const sample = realpathSync(tempDir());
    writeFileSync(join(sample, "a.txt"), "A");
    writeFileSync(join(sample, "b.txt"), "B");
    const docs = realpathSync(tempDir());
    writeFileSync(join(docs, "Transcript Editor Demo"), "i am a file");
    const target = await ensureSample({ sourceDir: sample, documentsDir: docs });
    expect(target).toBe(join(docs, "Transcript Editor Demo 2"));
    expect(readdirSync(target).sort()).toEqual(["a.txt", "b.txt"]);
    writeFileSync(join(target, "a.txt"), "edited");
    rmFile(join(target, "b.txt"));
    await ensureSample({ sourceDir: sample, documentsDir: docs });
    expect(readFileSync(join(target, "a.txt"), "utf8")).toBe("edited");
    expect(readFileSync(join(target, "b.txt"), "utf8")).toBe("B");
  });
  it("fails clearly when the sample is missing", async () => {
    const docs = realpathSync(tempDir());
    const err = await ensureSample({ sourceDir: join(docs, "nope"), documentsDir: docs }).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(HostFault);
    expect(err.code).toBe("not_found");
    mkdirSync(join(docs, "empty"));
    expect(
      (await ensureSample({ sourceDir: join(docs, "empty"), documentsDir: docs }).catch((e) => e))
        .code,
    ).toBe("not_found");
  });
});

import { rmSync } from "node:fs";
function rmFile(p: string) {
  rmSync(p);
}
