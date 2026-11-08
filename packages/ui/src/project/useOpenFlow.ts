import { useCallback, useEffect, useReducer, useRef } from "react";
import { parseProjectFile } from "@transcript-editor/core";
import {
  StorageError,
  type ProjectRef,
  type ProjectSession,
  type StorageProvider,
} from "@transcript-editor/storage";
import { MissingFileError, loadSession } from "./loadSession";
import {
  PROJECT_JSON,
  projectOf,
  reduce,
  type OpenEvent,
  type OpenState,
  type ResolveResult,
} from "./openFlow";

const errorOf = (e: unknown) =>
  e instanceof StorageError
    ? { code: e.code, message: e.message }
    : { code: "io_error", message: e instanceof Error ? e.message : String(e) };

/** Finds a free `proyecto.bak.json`, `proyecto.bak-2.json`, ... name (up to 20). */
export function backupName(existing: ReadonlySet<string>): string | null {
  for (let n = 1; n <= 20; n++) {
    const name = n === 1 ? "proyecto.bak.json" : `proyecto.bak-${n}.json`;
    if (!existing.has(name)) return name;
  }
  return null;
}

/**
 * Runs the open-flow state machine: the reducer is pure, the effects (open session, list files,
 * read proyecto.json, load) run here and dispatch results back.
 */
export function useOpenFlow(provider: StorageProvider) {
  const [state, dispatch] = useReducer(reduce, { s: "welcome" } as OpenState);
  const sessions = useRef(new Map<string, ProjectSession>());
  const stateRef = useRef(state);
  stateRef.current = state;

  const closeOthers = useCallback((keepKey: string | null) => {
    for (const [key, s] of sessions.current) {
      if (key !== keepKey) {
        sessions.current.delete(key);
        void s.close().catch(() => {});
      }
    }
  }, []);

  useEffect(() => {
    // Release host handles of projects we are no longer working on.
    closeOthers(projectOf(state)?.key ?? null);
  }, [state, closeOthers]);

  const resolve = useCallback(
    async (ref: ProjectRef): Promise<ResolveResult> => {
      let session = sessions.current.get(ref.key);
      if (!session) {
        session = await provider.open(ref);
        sessions.current.set(ref.key, session);
      }
      const files = await session.list();
      if (!files.some((f) => f.name === PROJECT_JSON)) return { kind: "noProject", files };
      const rawText = (await session.readText(PROJECT_JSON)).content;
      let json: unknown;
      try {
        json = JSON.parse(rawText);
      } catch (e) {
        return {
          kind: "damaged",
          files,
          rawText,
          parseError: e instanceof Error ? e.message : String(e),
        };
      }
      const parsed = parseProjectFile(json);
      if ("error" in parsed)
        return { kind: "damaged", files, rawText, parseError: "not_an_object" };
      return { kind: "ok", files, pf: parsed.project, warnings: parsed.warnings };
    },
    [provider],
  );

  useEffect(() => {
    let live = true;
    const alive = () => live && stateRef.current === state;
    const send = (e: OpenEvent) => {
      if (alive()) dispatch(e);
    };
    if (state.s === "picking") {
      provider.pickProject().then(
        (project) => send({ t: "PICKED", project }),
        (e) => send({ t: "FAIL", error: errorOf(e) }),
      );
    } else if (state.s === "resolving") {
      resolve(state.project).then(
        (result) => send({ t: "RESOLVED", result }),
        (e) => send({ t: "FAIL", error: errorOf(e) }),
      );
    } else if (state.s === "loading") {
      const session = sessions.current.get(state.project.key);
      if (!session) {
        send({ t: "FAIL", error: { code: "io_error", message: "session lost" } });
      } else {
        loadSession({
          ref: state.project,
          session,
          files: state.files,
          pf: state.pf,
          archivos: state.archivos,
          onDisk: state.onDisk,
          openPanel: state.openPanel,
          dirty: state.dirty,
        }).then(
          (loaded) => send({ t: "LOADED", loaded }),
          (e) =>
            e instanceof MissingFileError
              ? send({ t: "LOAD_NOT_FOUND", name: e.fileName })
              : send({ t: "FAIL", error: errorOf(e) }),
        );
      }
    }
    return () => {
      live = false;
    };
  }, [state, provider, resolve]);

  /** "Ignorar y crear uno nuevo": back up the damaged file byte for byte, then ask to create. */
  const ignoreDamaged = useCallback(async () => {
    const s = stateRef.current;
    if (s.s !== "projectDamaged") return;
    const session = sessions.current.get(s.project.key);
    if (!session) return;
    const name = backupName(new Set(s.files.map((f) => f.name)));
    if (!name) {
      dispatch({ t: "FAIL", error: { code: "backup_names_exhausted" } });
      return;
    }
    try {
      await session.writeText(name, s.rawText);
      const files = await session.list();
      dispatch({ t: "DAMAGED_IGNORED", files });
    } catch (e) {
      dispatch({ t: "FAIL", error: errorOf(e) });
    }
  }, []);

  return { state, dispatch, ignoreDamaged };
}
