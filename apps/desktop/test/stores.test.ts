import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Registry } from "../src/main/registry";
import { ConfigStore } from "../src/main/store/config";
import { StateStore } from "../src/main/store/state";
import { silentLog, tempDir } from "./helpers";

const key = (n: number) => n.toString(16).padStart(32, "0");
const now = "2025-05-05T10:00:00.000Z";

describe("ConfigStore", () => {
  const make = (dir: string) => new ConfigStore({ dir, debounceMs: 0, log: silentLog });

  it("starts with defaults and writes nothing until the first change", async () => {
    const dir = tempDir();
    const s = make(dir);
    await s.load();
    expect(s.get().language).toBe("es");
    expect(existsSync(join(dir, "config.json"))).toBe(false);
    s.update({ playbackRate: 1.5 });
    await s.flush();
    expect(JSON.parse(readFileSync(join(dir, "config.json"), "utf8")).playbackRate).toBe(1.5);
  });

  it("recovers from a corrupt file: .bak + defaults + recovered flag once", async () => {
    const dir = tempDir();
    writeFileSync(join(dir, "config.json"), "{not json");
    const s = make(dir);
    await s.load();
    expect(readFileSync(join(dir, "config.json.bak"), "utf8")).toBe("{not json");
    expect(s.get().language).toBe("es");
    expect(s.takeRecovered()).toBe(true);
    expect(s.takeRecovered()).toBe(false);
    writeFileSync(join(dir, "config.json"), "[1,2]");
    const s2 = make(dir);
    await s2.load();
    expect(s2.takeRecovered()).toBe(true);
  });

  it("keeps a newer version and unknown keys across a rewrite", async () => {
    const dir = tempDir();
    writeFileSync(
      join(dir, "config.json"),
      JSON.stringify({ version: 2, futureThing: { a: 1 }, autoScroll: false }),
    );
    const s = make(dir);
    await s.load();
    s.update({ sidebarCollapsed: true });
    await s.flush();
    const back = JSON.parse(readFileSync(join(dir, "config.json"), "utf8"));
    expect(back).toMatchObject({
      version: 2,
      futureThing: { a: 1 },
      autoScroll: false,
      sidebarCollapsed: true,
    });
  });

  it("loads partial files field by field", async () => {
    const dir = tempDir();
    writeFileSync(
      join(dir, "config.json"),
      JSON.stringify({ language: "en", playbackRate: "fast", recentProjects: [{ key: "bad" }] }),
    );
    const s = make(dir);
    await s.load();
    expect(s.get()).toMatchObject({ language: "en", playbackRate: 1, recentProjects: [] });
  });

  it("tracks recents (max 10, newest first) and lastProject", async () => {
    const dir = tempDir();
    const s = make(dir);
    await s.load();
    for (let i = 0; i < 12; i++) {
      s.touchProject({
        key: key(i),
        path: `/p${i}`,
        name: `p${i}`,
        lastOpenedAt: new Date(Date.UTC(2025, 0, 1, 0, i)).toISOString(),
      });
    }
    expect(s.get().recentProjects).toHaveLength(10);
    expect(s.get().recentProjects[0]?.key).toBe(key(11));
    expect(s.get().lastProject?.key).toBe(key(11));
    s.removeRecent(key(11));
    expect(s.get().lastProject).toBeNull();
    expect(s.get().recentProjects.some((r) => r.key === key(11))).toBe(false);
    s.clearRecents();
    expect(s.get().recentProjects).toEqual([]);
  });

  it("persists window bounds", async () => {
    const dir = tempDir();
    const s = make(dir);
    await s.load();
    s.setWindow({ width: 1000, height: 700, x: 10, y: 20, maximized: true });
    await s.flush();
    expect(JSON.parse(readFileSync(join(dir, "config.json"), "utf8")).window).toEqual({
      width: 1000,
      height: 700,
      x: 10,
      y: 20,
      maximized: true,
    });
  });
});

describe("StateStore", () => {
  const make = (dir: string) => new StateStore({ dir, debounceMs: 0, log: silentLog });
  it("saves, reloads and fills path/dates itself", async () => {
    const dir = tempDir();
    const s = make(dir);
    await s.load();
    s.save(
      key(1),
      { audioName: "a.mp4", positionSec: 12, activeParagraphId: 3, playbackRate: 1.5 },
      "/proj",
      new Date(now),
    );
    await s.flush();
    const s2 = make(dir);
    await s2.load();
    expect(s2.get(key(1))).toEqual({
      path: "/proj",
      lastOpenedAt: now,
      updatedAt: now,
      audioName: "a.mp4",
      positionSec: 12,
      activeParagraphId: 3,
      playbackRate: 1.5,
    });
    expect(s2.get(key(2))).toBeNull();
  });
  it("recovers from a corrupt file and drops bad keys individually", async () => {
    const dir = tempDir();
    writeFileSync(join(dir, "state.json"), "nope");
    const s = make(dir);
    await s.load();
    expect(existsSync(join(dir, "state.json.bak"))).toBe(true);
    const entry = {
      path: "/p",
      lastOpenedAt: now,
      audioName: "a",
      positionSec: 1,
      activeParagraphId: null,
      updatedAt: now,
    };
    writeFileSync(
      join(dir, "state.json"),
      JSON.stringify({ version: 1, projects: { [key(1)]: entry, bad: entry, [key(2)]: 7 } }),
    );
    const s2 = make(dir);
    await s2.load();
    expect(s2.get(key(1))).not.toBeNull();
    expect(s2.get(key(2))).toBeNull();
  });
});

describe("Registry", () => {
  it("keeps projects isolated per window and revokes on close", () => {
    const r = new Registry();
    r.addWindow(1);
    r.addWindow(2);
    const p = r.addProject(1, { root: "/a", key: key(1), displayName: "a" });
    expect(p.projectId).toMatch(/^[0-9a-f]{32}$/);
    expect(r.getProject(1, p.projectId)).toBeDefined();
    expect(r.getProject(2, p.projectId)).toBeUndefined();
    expect(r.findProject(p.projectId)).toBeDefined();
    expect(r.keysOf(1).has(key(1))).toBe(true);
    expect(r.keysOf(2).size).toBe(0);
    expect(r.rootOfKey(1, key(1))).toBe("/a");
    expect(r.closeProject(1, p.projectId)).toBe(true);
    expect(r.findProject(p.projectId)).toBeUndefined();
    r.removeWindow(1);
    expect(r.hasWindow(1)).toBe(false);
    expect(() => r.addProject(9, { root: "/x", key: key(2), displayName: "x" })).toThrow();
  });
});

void mkdirSync;
void readdirSync;
void realpathSync;
