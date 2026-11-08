import { describe, expect, it } from "vitest";
import { LocalFsProvider, StorageError, createGoogleDriveProvider, isStorageError } from "../src";
import { createMemoryHost } from "../src/testing/memoryHost";

const files = { "unido.txt": "A: hola\n", "proyecto.json": "{}", "unido.mp4": "bin" };

describe("LocalFsProvider", () => {
  it("picks a project, opens it with the same handle and lists files", async () => {
    const host = createMemoryHost(files);
    const p = new LocalFsProvider(host);
    const ref = await p.pickProject();
    expect(ref).toMatchObject({
      providerId: "local-fs",
      key: host.handle.projectKey,
      displayName: "sesion-demo",
    });
    const s = await p.open(ref!);
    const list = await s.list();
    expect(list.map((f) => f.name)).toEqual(["proyecto.json", "unido.mp4", "unido.txt"]);
    expect(list.find((f) => f.name === "unido.mp4")?.kind).toBe("audio");
    // one logical open never mints two ids: openRecent was not called
    expect(host.calls).not.toContain("project.openRecent");
    expect(host.opened).toHaveLength(1);
  });

  it("returns null when the user cancels and maps host errors to StorageError", async () => {
    const host = createMemoryHost(files);
    const p = new LocalFsProvider(host);
    host.pickResult = "cancel";
    expect(await p.pickProject()).toBeNull();
    host.pickResult = "error";
    await expect(p.pickProject()).rejects.toMatchObject({ code: "invalid_argument" });
    await expect(p.pickProject()).rejects.toBeInstanceOf(StorageError);
  });

  it("opens a recent project through the host when no handle is cached", async () => {
    const host = createMemoryHost(files);
    const p = new LocalFsProvider(host);
    const s = await p.open({
      providerId: "local-fs",
      key: host.handle.projectKey,
      displayName: "x",
    });
    expect((await s.readText("unido.txt")).content).toBe("A: hola\n");
    expect(host.calls.filter((c) => c === "project.openRecent")).toHaveLength(1);
    await expect(
      p.open({ providerId: "local-fs", key: "c".repeat(32), displayName: "x" }),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(p.open({ providerId: "other", key: "x", displayName: "x" })).rejects.toMatchObject(
      { code: "invalid_argument" },
    );
  });

  it("lists recents from settings", async () => {
    const host = createMemoryHost(files);
    const p = new LocalFsProvider(host);
    expect(await p.listRecent()).toEqual([]);
    await p.pickProject();
    const recents = await p.listRecent();
    expect(recents).toHaveLength(1);
    expect(recents[0]).toMatchObject({ key: host.handle.projectKey, displayName: "sesion-demo" });
  });

  it("tracks versions and detects conflicts", async () => {
    const host = createMemoryHost(files);
    const p = new LocalFsProvider(host);
    const s = await p.open((await p.pickProject())!);
    expect(s.versionOf("unido.txt")).toBeUndefined();
    const read = await s.readText("unido.txt");
    expect(s.versionOf("unido.txt")).toBe(read.version);
    const w = await s.writeText("unido.txt", "A: nuevo\n", { ifVersion: read.version });
    expect(s.versionOf("unido.txt")).toBe(w.version);
    expect(w.version).not.toBe(read.version);
    // stale version -> conflict
    await expect(
      s.writeText("unido.txt", "x\n", { ifVersion: read.version }),
    ).rejects.toMatchObject({ code: "conflict" });
    // external edit -> conflict, then overwrite without ifVersion works
    host.touch("unido.txt", "externo\n");
    await expect(s.writeText("unido.txt", "y\n", { ifVersion: w.version })).rejects.toMatchObject({
      code: "conflict",
    });
    await expect(s.writeText("unido.txt", "y\n")).resolves.toBeDefined();
    expect(host.files.get("unido.txt")?.content).toBe("y\n");
  });

  it("reports conflict when the file was deleted and creates new files without ifVersion", async () => {
    const host = createMemoryHost(files);
    const p = new LocalFsProvider(host);
    const s = await p.open((await p.pickProject())!);
    const r = await s.readText("proyecto.json");
    host.deleteFile("proyecto.json");
    await expect(
      s.writeText("proyecto.json", "{}", { ifVersion: r.version }),
    ).rejects.toMatchObject({ code: "conflict" });
    const created = await s.writeText("nuevo.json", "[]");
    expect(s.versionOf("nuevo.json")).toBe(created.version);
    expect(await s.exists("nuevo.json")).toBe(true);
    expect(await s.exists("nada.json")).toBe(false);
  });

  it("rejects invalid names, non text reads and unknown media", async () => {
    const host = createMemoryHost(files);
    const p = new LocalFsProvider(host);
    const s = await p.open((await p.pickProject())!);
    await expect(s.readText("../x.txt")).rejects.toMatchObject({ code: "invalid_name" });
    await expect(s.readText("unido.mp4")).rejects.toMatchObject({ code: "invalid_name" });
    await expect(s.readText("falta.txt")).rejects.toMatchObject({ code: "not_found" });
    await expect(s.mediaUrl("falta.mp4")).rejects.toMatchObject({ code: "not_found" });
    expect(await s.mediaUrl("unido.mp4")).toBe(`memory://media/${host.handle.projectId}/unido.mp4`);
  });

  it("close deletes the handle so the next open asks the host again", async () => {
    const host = createMemoryHost(files);
    const p = new LocalFsProvider(host);
    const ref = (await p.pickProject())!;
    const s = await p.open(ref);
    await s.close();
    expect(host.closedIds).toEqual([host.handle.projectId]);
    await p.open(ref);
    expect(host.calls).toContain("project.openRecent");
  });

  it("release closes an unopened handle once and forget removes the recent", async () => {
    const host = createMemoryHost(files);
    const p = new LocalFsProvider(host);
    const ref = (await p.pickProject())!;
    await p.release(ref);
    await p.release(ref);
    expect(host.closedIds).toHaveLength(1);
    await p.forget(ref);
    expect(await p.listRecent()).toEqual([]);
  });

  it("opens the sample", async () => {
    const host = createMemoryHost(files);
    const p = new LocalFsProvider(host);
    const ref = await p.openSample();
    expect(ref.key).toBe(host.handle.projectKey);
  });
});

describe("memory host semantics", () => {
  it("rejects unknown project ids", async () => {
    const host = createMemoryHost(files);
    expect((await host.project.listFiles("z".repeat(32))).ok).toBe(false);
    const r = await host.project.readText("z".repeat(32), "unido.txt");
    expect(r.ok).toBe(false);
  });
  it("persists settings and sessions", async () => {
    const host = createMemoryHost(files);
    await host.settings.update({ playbackRate: 1.5 });
    expect((await host.settings.get()).ok && (await host.settings.get())).toBeTruthy();
    await host.session.save("k".repeat(32), {
      audioName: "a.mp4",
      positionSec: 4,
      activeParagraphId: 2,
    });
    const s = await host.session.get("k".repeat(32));
    expect(s.ok && s.value?.positionSec).toBe(4);
  });
});

describe("google drive stub", () => {
  it("is all capabilities false and rejects with unsupported", async () => {
    const p = createGoogleDriveProvider();
    expect(Object.values(p.capabilities).every((v) => v === false)).toBe(true);
    for (const call of [
      () => p.pickProject(),
      () => p.listRecent(),
      () => p.open({ providerId: "google-drive", key: "k", displayName: "x" }),
    ]) {
      await expect(call()).rejects.toSatisfy((e) => isStorageError(e) && e.code === "unsupported");
    }
  });
});
