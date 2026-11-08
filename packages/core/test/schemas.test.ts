import { describe, expect, it } from "vitest";
import {
  assertResolved,
  canResume,
  ConfigSchema,
  dedupeRecents,
  defaultConfig,
  defaultState,
  detectFiles,
  emptyProject,
  isProjectResolved,
  migrateConfig,
  migrateProject,
  parseConfig,
  parseProjectFile,
  pruneState,
  serializeConfig,
  serializeProject,
  SessionStateInputSchema,
  SettingsPatchSchema,
  StateFileSchema,
  type RecentProject,
} from "../src";

const key = (n: number) => n.toString(16).padStart(32, "0");
const recent = (n: number, at: string): RecentProject => ({
  key: key(n),
  path: `/tmp/p${n}`,
  name: `p${n}`,
  lastOpenedAt: at,
});

describe("parseProjectFile", () => {
  it("rejects non objects", () => {
    for (const bad of [null, [], "x", 3])
      expect(parseProjectFile(bad)).toEqual({ error: "not_an_object" });
  });
  it("fills defaults for an empty object", () => {
    const r = parseProjectFile({});
    if ("error" in r) throw new Error("unexpected");
    expect(r.project).toMatchObject({
      version: 1,
      titulo: "",
      descripcion: "",
      archivos: {},
      speakers: [],
    });
    expect(r.project.visualizacion.colorearTexto).toBe(true);
    expect(r.warnings).toEqual([]);
  });
  it("keeps unknown keys and drops bad speaker rows with warnings", () => {
    const r = parseProjectFile({
      titulo: 7,
      extra: { a: 1 },
      archivos: { audio: "a.mp4", texto: "t.txt", otro: 1 },
      speakers: [
        { id: "A", nombre: "Ana", iniciales: "AN", color: "#ABCDEF", nota: "x" },
        { id: "A", nombre: "dup" },
        { id: "" },
        "garbage",
        { id: "B", color: "red" },
        { id: "C", color: "  " },
      ],
      visualizacion: { mostrar: "nombre", colorearTexto: "yes", otra: 1 },
    });
    if ("error" in r) throw new Error("unexpected");
    expect(r.project.titulo).toBe("");
    expect(r.project.extra).toEqual({ a: 1 });
    expect(r.project.archivos.otro).toBe(1);
    expect(r.project.speakers.map((s) => [s.id, s.color])).toEqual([
      ["A", "#abcdef"],
      ["B", null],
      ["C", null],
    ]);
    expect(r.project.speakers[0]?.nota).toBe("x");
    expect(r.project.visualizacion).toMatchObject({
      mostrar: "nombre",
      colorearTexto: true,
      otra: 1,
    });
    expect(r.warnings).toEqual([
      { code: "speaker_duplicate", id: "A" },
      { code: "speaker_dropped", index: 2 },
      { code: "speaker_dropped", index: 3 },
    ]);
  });
  it("removes unsafe file references", () => {
    const r = parseProjectFile({
      archivos: { audio: "../x.mp4", texto: "ok.txt", meta: "a/b.json" },
    });
    if ("error" in r) throw new Error("unexpected");
    expect(r.project.archivos).toEqual({ texto: "ok.txt" });
    expect(r.warnings).toEqual([
      { code: "invalid_file_reference", field: "audio" },
      { code: "invalid_file_reference", field: "meta" },
    ]);
  });
  it("handles an invalid mostrar enum and non-object parts", () => {
    const r = parseProjectFile({
      visualizacion: { mostrar: "otro" },
      archivos: "x",
      speakers: "no",
    });
    if ("error" in r) throw new Error("unexpected");
    expect(r.project.visualizacion.mostrar).toBeUndefined();
    expect(r.project.archivos).toEqual({});
    expect(r.project.speakers).toEqual([]);
    const r2 = parseProjectFile({ visualizacion: 5 });
    if ("error" in r2) throw new Error("unexpected");
    expect(r2.project.visualizacion.colorearTexto).toBe(true);
  });
  it("migrates versions and keeps newer ones", () => {
    expect(migrateProject({}).raw.version).toBe(1);
    expect(migrateProject({ version: "x" }).raw.version).toBe(1);
    expect(migrateProject({ version: 0 }).raw.version).toBe(1);
    const r = parseProjectFile({ version: 3 });
    if ("error" in r) throw new Error("unexpected");
    expect(r.warnings).toEqual([{ code: "newer_version", version: 3 }]);
    expect(JSON.parse(serializeProject(r.project)).version).toBe(3);
  });
  it("serializes with null colors, no empty mostrar and a trailing newline", () => {
    const p = emptyProject();
    p.speakers = [{ id: "A", nombre: "", iniciales: "", color: null }];
    p.visualizacion.mostrar = undefined;
    p.archivos = { audio: "a.mp4", texto: "t.txt" };
    const text = serializeProject(p);
    expect(text.endsWith("}\n")).toBe(true);
    const back = JSON.parse(text);
    expect(back.speakers[0].color).toBeNull();
    expect("mostrar" in back.visualizacion).toBe(false);
    expect(back.version).toBe(1);
  });
  it("requires audio and texto before creating the file", () => {
    const p = emptyProject();
    expect(isProjectResolved(p)).toBe(false);
    expect(() => assertResolved(p)).toThrow();
    p.archivos = { audio: "a.mp4", texto: "t.txt" };
    expect(isProjectResolved(p)).toBe(true);
    expect(() => assertResolved(p)).not.toThrow();
  });
});

describe("detectFiles", () => {
  const f = (name: string) => ({
    name,
    kind: name.endsWith(".txt")
      ? ("text" as const)
      : name.endsWith(".json")
        ? ("json" as const)
        : name.match(/\.(mp4|m4a|mp3|wav|ogg)$/)
          ? ("audio" as const)
          : ("other" as const),
  });
  it("prefers unido.*", () => {
    const r = detectFiles(
      ["otro.mp3", "unido.mp4", "unido.txt", "unido.meta.json", "x.txt"].map(f),
    );
    expect(r).toEqual({ audio: "unido.mp4", texto: "unido.txt", meta: "unido.meta.json" });
  });
  it("uses the only candidate of each kind", () => {
    const r = detectFiles(["clase.m4a", "clase.txt", "clase.meta.json", "proyecto.json"].map(f));
    expect(r).toEqual({ audio: "clase.m4a", texto: "clase.txt", meta: "clase.meta.json" });
  });
  it("is undefined when ambiguous and ignores project files", () => {
    const r = detectFiles(
      ["a.mp3", "b.wav", "a.txt", "b.txt", "proyecto.json", "proyecto.bak.json"].map(f),
    );
    expect(r).toEqual({});
  });
  it("prefers the edited copy next to a raw transcript", () => {
    const r = detectFiles(["s.mp4", "s.txt", "s.editado.txt", "s.editado.meta.json"].map(f));
    expect(r.texto).toBe("s.editado.txt");
    expect(r.meta).toBe("s.editado.meta.json");
  });
  it("falls back to the only *.meta.json", () => {
    expect(detectFiles(["z.meta.json", "a.txt"].map(f)).meta).toBe("z.meta.json");
  });
});

describe("config", () => {
  it("defaults", () => {
    const c = defaultConfig();
    expect(c).toMatchObject({
      version: 1,
      language: "es",
      theme: "dark",
      lastProject: null,
      recentProjects: [],
      playbackRate: 1,
      sidebarCollapsed: false,
      autoScroll: true,
      drive: { rootFolderId: null },
    });
    expect(c.window).toEqual({ width: 1280, height: 800, maximized: false });
  });
  it("recovers per field", () => {
    const c = ConfigSchema.parse({
      language: "fr",
      playbackRate: 99,
      sidebarCollapsed: "yes",
      window: { width: 10, height: 700, x: 1.5 },
      drive: "x",
      recentProjects: [recent(1, "2025-01-01T00:00:00.000Z"), { key: "bad" }, 5],
    });
    expect(c.language).toBe("es");
    expect(c.playbackRate).toBe(1);
    expect(c.sidebarCollapsed).toBe(false);
    expect(c.window).toMatchObject({ width: 1280, height: 700 });
    expect(c.drive.rootFolderId).toBeNull();
    expect(c.recentProjects).toHaveLength(1);
  });
  it("returns null for non-objects", () => {
    for (const bad of [null, [], "x", 1]) expect(parseConfig(bad)).toBeNull();
  });
  it("round trips a newer version and unknown keys", () => {
    const c = parseConfig({ version: 2, futureThing: { a: 1 }, autoScroll: false });
    expect(c).not.toBeNull();
    const back = JSON.parse(serializeConfig({ ...c!, autoScroll: true }));
    expect(back.version).toBe(2);
    expect(back.futureThing).toEqual({ a: 1 });
    expect(back.autoScroll).toBe(true);
  });
  it("migrates a synthetic v0 file", () => {
    expect(migrateConfig({ language: "en" })).toEqual({ language: "en", version: 1 });
    expect(parseConfig({ language: "en" })?.version).toBe(1);
  });
  it("dedupes recents: newest wins, capped at 10, stable on ties", () => {
    const rows = [
      recent(1, "2025-01-01T00:00:00.000Z"),
      recent(1, "2025-03-01T00:00:00.000Z"),
      recent(2, "2025-02-01T00:00:00.000Z"),
    ];
    const out = dedupeRecents(rows);
    expect(out.map((r) => r.key)).toEqual([key(1), key(2)]);
    expect(out[0]?.lastOpenedAt).toBe("2025-03-01T00:00:00.000Z");
    const many = Array.from({ length: 15 }, (_, i) => recent(i, "2025-01-01T00:00:00.000Z"));
    const capped = dedupeRecents(many);
    expect(capped).toHaveLength(10);
    expect(capped.map((r) => r.key)).toEqual(many.slice(0, 10).map((r) => r.key));
  });
  it("validates settings patches strictly", () => {
    expect(SettingsPatchSchema.safeParse({ playbackRate: 1.5 }).success).toBe(true);
    expect(SettingsPatchSchema.safeParse({ lastProject: null }).success).toBe(false);
    expect(SettingsPatchSchema.safeParse({ playbackRate: 10 }).success).toBe(false);
    expect(SettingsPatchSchema.safeParse({ drive: { rootFolderId: "x" } }).success).toBe(false);
  });
});

describe("state", () => {
  const now = "2025-05-05T10:00:00.000Z";
  const entry = (extra = {}) => ({
    path: "/p",
    lastOpenedAt: now,
    audioName: "a.mp4",
    positionSec: 5,
    activeParagraphId: 1,
    updatedAt: now,
    ...extra,
  });
  it("drops a bad key and a bad entry but keeps the good ones", () => {
    const s = StateFileSchema.parse({
      version: 1,
      projects: {
        [key(1)]: entry(),
        [key(2)]: entry({ positionSec: -4 }),
        "not-a-key": entry(),
        [key(3)]: "junk",
        [key(4)]: { path: 5 },
      },
      futureThing: true,
    });
    expect(Object.keys(s.projects).sort()).toEqual([key(1), key(2)]);
    expect(s.projects[key(2)]?.positionSec).toBe(0);
    expect((s as Record<string, unknown>).futureThing).toBe(true);
  });
  it("defaults and prunes to 200 by recency", () => {
    expect(defaultState()).toEqual({ version: 1, projects: {} });
    const projects: Record<string, ReturnType<typeof entry>> = {};
    for (let i = 0; i < 205; i++)
      projects[key(i)] = entry({
        lastOpenedAt: new Date(Date.UTC(2025, 0, 1, 0, 0, i)).toISOString(),
      });
    const pruned = pruneState({ version: 1, projects } as never);
    expect(Object.keys(pruned.projects)).toHaveLength(200);
    expect(pruned.projects[key(0)]).toBeUndefined();
    expect(pruned.projects[key(204)]).toBeDefined();
  });
  it("validates the renderer input strictly", () => {
    const ok = { audioName: "a.mp4", positionSec: 3, activeParagraphId: null };
    expect(SessionStateInputSchema.safeParse(ok).success).toBe(true);
    expect(SessionStateInputSchema.safeParse({ ...ok, path: "/etc" }).success).toBe(false);
    expect(SessionStateInputSchema.safeParse({ ...ok, positionSec: -1 }).success).toBe(false);
    expect(SessionStateInputSchema.safeParse({ ...ok, activeParagraphId: 1.5 }).success).toBe(
      false,
    );
  });
  it("resumes only for the same audio and a position inside the duration", () => {
    const saved = StateFileSchema.parse({ projects: { [key(1)]: entry() } }).projects[key(1)]!;
    expect(canResume(saved, "a.mp4", 100)).toBe(true);
    expect(canResume(saved, "b.mp4", 100)).toBe(false);
    expect(canResume(saved, "a.mp4", 3)).toBe(false);
    expect(canResume(saved, "a.mp4", NaN)).toBe(false);
    expect(canResume(null, "a.mp4", 100)).toBe(false);
  });
});
