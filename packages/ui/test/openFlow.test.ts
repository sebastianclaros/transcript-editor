import { describe, expect, it } from "vitest";
import { emptyProject, type ProjectFile } from "@transcript-editor/core";
import type { FileEntry, ProjectRef } from "@transcript-editor/storage";
import {
  missingFiles,
  reduce,
  type LoadedSession,
  type OpenEvent,
  type OpenState,
} from "../src/project/openFlow";

const ref: ProjectRef = { providerId: "local-fs", key: "k".repeat(32), displayName: "sesion" };
const f = (name: string): FileEntry => ({
  name,
  kind: /\.(mp4|m4a|mp3)$/.test(name)
    ? "audio"
    : name.endsWith(".txt")
      ? "text"
      : name.endsWith(".json")
        ? "json"
        : "other",
  size: 1,
  mtimeMs: 1,
});
const pf = (archivos: ProjectFile["archivos"]): ProjectFile => ({ ...emptyProject(), archivos });
const loaded = { ref } as unknown as LoadedSession;

const filesOk = [f("a.m4a"), f("a.txt"), f("a.meta.json"), f("proyecto.json")];

describe("open flow reducer", () => {
  it("picks, cancels and resolves", () => {
    let s: OpenState = { s: "welcome" };
    s = reduce(s, { t: "PICK" });
    expect(s).toEqual({ s: "picking", from: null });
    expect(reduce(s, { t: "PICKED", project: null })).toEqual({ s: "welcome" });
    s = reduce(s, { t: "PICKED", project: ref });
    expect(s).toEqual({ s: "resolving", project: ref });
  });

  it("goes to askCreate when proyecto.json is missing and detects files", () => {
    const s = reduce(
      { s: "resolving", project: ref },
      { t: "RESOLVED", result: { kind: "noProject", files: [f("unido.mp4"), f("unido.txt")] } },
    );
    expect(s).toMatchObject({
      s: "askCreate",
      detected: { audio: "unido.mp4", texto: "unido.txt" },
    });
  });

  it("Crear opens the mapping dialog (files only) with createProject", () => {
    const ask: OpenState = {
      s: "askCreate",
      project: ref,
      files: [f("a.m4a"), f("a.txt")],
      detected: { audio: "a.m4a", texto: "a.txt" },
    };
    const m = reduce(ask, { t: "CREATE" });
    expect(m).toMatchObject({ s: "mapping", reason: "new-folder", createProject: true });
    if (m.s !== "mapping") throw new Error();
    expect(m.draft.archivos).toEqual({ audio: "a.m4a", texto: "a.txt" });
    const l = reduce(m, { t: "MAP_CONFIRM", draft: m.draft, save: true });
    expect(l).toMatchObject({ s: "loading", openPanel: true, dirty: true, onDisk: false });
    if (l.s !== "loading") throw new Error();
    expect(l.pf).not.toBeNull();
  });

  it("Continuar sin proyecto loads without a project when unambiguous", () => {
    const ask: OpenState = {
      s: "askCreate",
      project: ref,
      files: [f("a.m4a"), f("a.txt")],
      detected: { audio: "a.m4a", texto: "a.txt" },
    };
    expect(reduce(ask, { t: "CONTINUE" })).toMatchObject({
      s: "loading",
      pf: null,
      openPanel: true,
      dirty: false,
    });
  });

  it("Continuar sin proyecto goes to mapping when ambiguous", () => {
    const ask: OpenState = {
      s: "askCreate",
      project: ref,
      files: [f("a.m4a"), f("b.m4a"), f("a.txt")],
      detected: { texto: "a.txt" },
    };
    expect(reduce(ask, { t: "CONTINUE" })).toMatchObject({
      s: "mapping",
      reason: "ambiguous",
      createProject: false,
    });
  });

  it("mapping without saving the choice yields pf null", () => {
    const m: OpenState = {
      s: "mapping",
      project: ref,
      files: filesOk,
      draft: pf({ audio: "a.m4a", texto: "a.txt" }),
      reason: "ambiguous",
      createProject: false,
      missing: [],
    };
    const l = reduce(m, {
      t: "MAP_CONFIRM",
      draft: pf({ audio: "a.m4a", texto: "a.txt" }),
      save: false,
    });
    expect(l).toMatchObject({ s: "loading", pf: null, dirty: false });
  });

  it("an existing project with all files loads straight away", () => {
    const s = reduce(
      { s: "resolving", project: ref },
      {
        t: "RESOLVED",
        result: {
          kind: "ok",
          files: filesOk,
          pf: pf({ audio: "a.m4a", texto: "a.txt", meta: "a.meta.json" }),
          warnings: [],
        },
      },
    );
    expect(s).toMatchObject({ s: "loading", onDisk: true, dirty: false, openPanel: false });
  });

  it("a missing meta is not an error (dropped from archivos)", () => {
    const s = reduce(
      { s: "resolving", project: ref },
      {
        t: "RESOLVED",
        result: {
          kind: "ok",
          files: [f("a.m4a"), f("a.txt")],
          pf: pf({ audio: "a.m4a", texto: "a.txt", meta: "x.meta.json" }),
          warnings: [],
        },
      },
    );
    expect(s.s).toBe("loading");
    if (s.s === "loading") expect(s.archivos.meta).toBeUndefined();
  });

  it("missing audio/texto goes to mapping prefilled from detection", () => {
    const s = reduce(
      { s: "resolving", project: ref },
      {
        t: "RESOLVED",
        result: {
          kind: "ok",
          files: [f("b.m4a"), f("b.txt")],
          pf: pf({ audio: "a.m4a", texto: "a.txt" }),
          warnings: [],
        },
      },
    );
    expect(s).toMatchObject({ s: "mapping", reason: "missing-files", missing: ["a.m4a", "a.txt"] });
    if (s.s === "mapping") expect(s.draft.archivos).toEqual({ audio: "b.m4a", texto: "b.txt" });
    expect(missingFiles({}, filesOk)).toEqual(["audio", "texto"]);
  });

  it("damaged project: view, cancel back, apply, ignore", () => {
    const damaged: OpenState = {
      s: "projectDamaged",
      project: ref,
      files: filesOk,
      rawText: "{oops",
      parseError: "bad",
    };
    const view = reduce(damaged, { t: "DAMAGED_VIEW" });
    expect(view).toMatchObject({ s: "jsonView", rawText: "{oops", parseError: "bad" });
    expect(reduce(view, { t: "JSON_CANCEL" })).toEqual(damaged);
    const applied = reduce(view, { t: "JSON_APPLY", pf: pf({ audio: "a.m4a", texto: "a.txt" }) });
    expect(applied).toMatchObject({ s: "loading", dirty: true, onDisk: true });
    expect(reduce(damaged, { t: "DAMAGED_IGNORED", files: filesOk })).toMatchObject({
      s: "askCreate",
    });
    expect(reduce(damaged, { t: "CANCEL" })).toEqual({ s: "welcome" });
  });

  it("load not found returns to mapping; loaded goes ready; failure and dismiss", () => {
    const loading: OpenState = {
      s: "loading",
      project: ref,
      files: filesOk,
      pf: null,
      archivos: { audio: "a.m4a", texto: "gone.txt" },
      onDisk: false,
      openPanel: true,
      dirty: false,
    };
    const m = reduce(loading, { t: "LOAD_NOT_FOUND", name: "gone.txt" });
    expect(m).toMatchObject({ s: "mapping", reason: "missing-files", missing: ["gone.txt"] });
    if (m.s === "mapping") expect(m.draft.archivos).toEqual({ audio: "a.m4a" });
    expect(reduce(loading, { t: "LOADED", loaded })).toMatchObject({ s: "ready" });
    const failed = reduce(loading, { t: "FAIL", error: { code: "io_error" } });
    expect(failed).toEqual({ s: "failed", error: { code: "io_error" } });
    expect(reduce(failed, { t: "DISMISS" })).toEqual({ s: "welcome" });
  });

  it("opens another project from ready and closes to welcome", () => {
    const ready: OpenState = { s: "ready", project: ref, loaded };
    expect(reduce(ready, { t: "OPEN", project: ref }).s).toBe("resolving");
    // picking from the editor (already guarded) keeps it on screen if the dialog is cancelled
    const picking = reduce(ready, { t: "PICK" });
    expect(picking).toEqual({ s: "picking", from: ready });
    expect(reduce(picking, { t: "PICKED", project: null })).toEqual(ready);
    expect(reduce(ready, { t: "CLOSE" })).toEqual({ s: "welcome" });
  });

  it("ignores every event that makes no sense in a state", () => {
    const all: OpenEvent[] = [
      { t: "CREATE" },
      { t: "CONTINUE" },
      { t: "DAMAGED_VIEW" },
      { t: "JSON_CANCEL" },
      { t: "LOADED", loaded },
      { t: "LOAD_NOT_FOUND", name: "x" },
      { t: "MAP_CONFIRM", draft: emptyProject(), save: true },
      { t: "RESOLVED", result: { kind: "noProject", files: [] } },
      { t: "PICKED", project: ref },
      { t: "DISMISS" },
    ];
    const welcome: OpenState = { s: "welcome" };
    for (const e of all) expect(reduce(welcome, e), e.t).toBe(welcome);
  });
});
