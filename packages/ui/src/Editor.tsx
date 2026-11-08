import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  activeIndex,
  buildSpeakerInfo,
  canResume,
  cycleEstado,
  defaultProject,
  editParagraph,
  emptyProject,
  labelsInOrder,
  markRead,
  markVerified,
  snapRate,
  type Language,
  type MessageKey,
  type Paragraph,
  type Params,
  type ProjectFile,
  type SessionState,
} from "@transcript-editor/core";
import type {
  HostApi,
  MenuCommand,
  SettingsView,
  StorageError,
  UpdateStatus,
} from "@transcript-editor/storage";
import { Dialog } from "./components/Dialog";
import { IcMenu, IcPersonas } from "./components/Icons";
import { Toast, useToast } from "./components/useToast";
import { HelpModal } from "./help/HelpModal";
import { useHotkeys } from "./hotkeys/useHotkeys";
import { useT } from "./i18n/I18n";
import { Transport } from "./player/Transport";
import { useActiveSync } from "./player/useActiveSync";
import { usePlayer } from "./player/usePlayer";
import { JsonView } from "./project/JsonView";
import type { LoadedSession } from "./project/openFlow";
import { ProjectModal } from "./project/ProjectModal";
import { performSave } from "./project/save";
import { Minimap } from "./sidebar/Minimap";
import { ProjectPanel } from "./sidebar/ProjectPanel";
import { Section } from "./sidebar/Section";
import { StatsWidget } from "./sidebar/StatsWidget";
import { Transcript } from "./transcript/Transcript";
import { serializeProject } from "@transcript-editor/core";

interface Props {
  host: HostApi;
  loaded: LoadedSession;
  settings: SettingsView;
  onLanguage: (lang: Language) => void;
  /** Ask the host for another folder (already guarded against unsaved changes). */
  onPick: () => void;
  /** Reload the same project from storage (already guarded). */
  onReload: () => void;
}

type Leave = { kind: "open" | "reload" | "close"; run: () => void; cancel?: () => void };

const SESSION_SAVE_MS = 5000;

/** The editor: fixed top bar with the player, sidebar gadgets, paragraph list and stats. */
export function Editor({ host, loaded, settings, onLanguage, onPick, onReload }: Props) {
  const t = useT();
  const mod = host.platform === "darwin" ? "Cmd" : "Ctrl";
  const toast = useToast();
  const say = useCallback(
    (key: MessageKey, params?: Params) => toast.show(t(key, params)),
    // `toast.show` is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  );

  // ---- document state (mirrored in refs so callbacks never see stale values) ----
  const [paragraphs, setParagraphs] = useState<Paragraph[]>(loaded.paragraphs);
  const paragraphsRef = useRef(paragraphs);
  const [activeId, setActiveIdState] = useState<number | null>(null);
  const activeIdRef = useRef<number | null>(null);
  const setActiveId = useCallback((id: number | null) => {
    activeIdRef.current = id;
    setActiveIdState(id);
  }, []);

  const initialPf = useMemo<ProjectFile | null>(() => {
    const pf = loaded.pf;
    if (!pf) return null;
    if (loaded.panelMode === "edit" && !loaded.onDisk && pf.speakers.length === 0) {
      return {
        ...pf,
        titulo: pf.titulo || loaded.ref.displayName,
        speakers: defaultProject(labelsInOrder(loaded.paragraphs)).speakers,
      };
    }
    return pf;
    // computed once per loaded session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [pf, setPfState] = useState<ProjectFile | null>(initialPf);
  const pfRef = useRef(pf);
  const [dirty, setDirtyState] = useState(loaded.initialDirty);
  const dirtyRef = useRef(dirty);
  const pfDirtyRef = useRef(loaded.initialDirty && loaded.pf !== null);
  const docRef = useRef({
    format: loaded.format,
    textName: loaded.textName,
    metaName: loaded.metaName,
    rawName: loaded.rawName,
    onDisk: loaded.onDisk,
  });
  const savingRef = useRef(false);

  const setDirty = useCallback((v: boolean) => {
    dirtyRef.current = v;
    setDirtyState(v);
  }, []);
  const commit = useCallback(
    (next: Paragraph[]) => {
      paragraphsRef.current = next;
      setParagraphs(next);
      setDirty(true);
    },
    [setDirty],
  );
  const changeProject = useCallback(
    (next: ProjectFile) => {
      pfRef.current = next;
      pfDirtyRef.current = true;
      setPfState(next);
      setDirty(true);
    },
    [setDirty],
  );

  // ---- UI state ----
  const [status, setStatus] = useState(() =>
    t("status.loaded", {
      n: loaded.paragraphs.length,
      timed: loaded.paragraphs.filter((p) => p.seconds >= 0).length,
    }),
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [autoScroll, setAutoScrollState] = useState(settings.autoScroll);
  const autoScrollRef = useRef(autoScroll);
  const [sidebarOpen, setSidebarOpen] = useState(!settings.sidebarCollapsed);
  const [helpOpen, setHelpOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(loaded.panelMode === "edit");
  const [jsonOpen, setJsonOpen] = useState(false);
  const [conflict, setConflict] = useState<{ file: string; confirmReload: boolean } | null>(null);
  const [leave, setLeave] = useState<Leave | null>(null);
  const [audioError, setAudioError] = useState(false);
  const [update, setUpdate] = useState<UpdateStatus>({ state: "idle" });

  const mediaRef = useRef<HTMLAudioElement>(null);
  const lineRefs = useRef(new Map<number, HTMLDivElement>());
  const register = useCallback((id: number, node: HTMLDivElement | null) => {
    if (node) lineRefs.current.set(id, node);
    else lineRefs.current.delete(id);
  }, []);

  // ---- player ----
  const player = usePlayer({
    mediaRef,
    paragraphsRef,
    activeIdRef,
    say,
    initialRate: settings.playbackRate,
    onRateChanged: (rate) => void host.settings.update({ playbackRate: rate }),
  });

  useActiveSync({
    mediaRef,
    paragraphsRef,
    activeIdRef,
    setActiveId,
    onEnter: (id) => {
      const r = markRead(paragraphsRef.current, id);
      if (r.changed) commit(r.paragraphs);
    },
  });

  // Auto-scroll ONLY when the active paragraph id changes.
  useEffect(() => {
    if (!autoScrollRef.current || activeId == null) return;
    lineRefs.current.get(activeId)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeId]);

  // ---- session memory: resume and periodic save ----
  const savedSession = useRef<SessionState | null>(null);
  const resumed = useRef(false);
  const persistSession = useCallback(() => {
    const el = mediaRef.current;
    if (!el) return;
    const positionSec = Number.isFinite(el.currentTime) ? Math.max(0, el.currentTime) : 0;
    void host.session.save(loaded.ref.key, {
      audioName: loaded.audioName,
      positionSec,
      activeParagraphId: activeIdRef.current,
      playbackRate: el.playbackRate || undefined,
    });
  }, [host, loaded.ref.key, loaded.audioName]);

  useEffect(() => {
    let cancelled = false;
    const el = mediaRef.current;
    const tryResume = () => {
      const saved = savedSession.current;
      if (!el || !saved || resumed.current || !Number.isFinite(el.duration)) return;
      resumed.current = true;
      if (canResume(saved, loaded.audioName, el.duration)) {
        el.currentTime = saved.positionSec;
        if (
          saved.activeParagraphId != null &&
          paragraphsRef.current.some((p) => p.id === saved.activeParagraphId)
        ) {
          setActiveId(saved.activeParagraphId);
        }
      }
    };
    void host.session.get(loaded.ref.key).then((r) => {
      if (cancelled) return;
      savedSession.current = r.ok ? r.value : null;
      const rate =
        r.ok && r.value?.playbackRate != null ? r.value.playbackRate : settings.playbackRate;
      player.setRate(snapRate(rate), { announce: false, persist: false });
      if (el && el.readyState >= 1) tryResume();
    });
    el?.addEventListener("loadedmetadata", tryResume);
    return () => {
      cancelled = true;
      el?.removeEventListener("loadedmetadata", tryResume);
    };
    // once per loaded session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = mediaRef.current;
    const timer = setInterval(() => {
      if (el && !el.paused) persistSession();
    }, SESSION_SAVE_MS);
    el?.addEventListener("pause", persistSession);
    return () => {
      clearInterval(timer);
      el?.removeEventListener("pause", persistSession);
      persistSession();
    };
  }, [persistSession]);

  // ---- editing ----
  const editLine = useCallback(
    (id: number, text: string) => {
      const r = editParagraph(paragraphsRef.current, id, text);
      if (r.changed) commit(r.paragraphs);
    },
    [commit],
  );
  const cycleLine = useCallback(
    (id: number) => {
      const r = cycleEstado(paragraphsRef.current, id);
      if (r.changed) commit(r.paragraphs);
    },
    [commit],
  );
  const markActiveVerified = useCallback(() => {
    let id = activeIdRef.current;
    if (id == null) {
      const i = activeIndex(paragraphsRef.current, null, mediaRef.current?.currentTime ?? 0);
      if (i >= 0) id = paragraphsRef.current[i]?.id ?? null;
    }
    if (id == null) {
      say("toast.noActiveParagraph");
      return;
    }
    const r = markVerified(paragraphsRef.current, id);
    if (r.changed) commit(r.paragraphs);
    setStatus(t("status.verified"));
    say("toast.verified");
  }, [commit, say, t]);

  const goToLine = useCallback(
    (id: number) => {
      const p = paragraphsRef.current.find((x) => x.id === id);
      if (p && p.seconds >= 0) player.seekTo(p.seconds);
      lineRefs.current.get(id)?.scrollIntoView({ block: "center", behavior: "smooth" });
    },
    [player],
  );

  // ---- saving ----
  const save = useCallback(
    async (force = false): Promise<boolean> => {
      if (savingRef.current) return false;
      savingRef.current = true;
      const ps = paragraphsRef.current;
      const projectAtStart = pfRef.current;
      try {
        const doc = docRef.current;
        const isRaw = doc.rawName !== null && doc.textName === doc.rawName;
        const existing = isRaw
          ? new Set((await loaded.session.list()).map((f) => f.name))
          : new Set<string>();
        const out = await performSave({
          session: loaded.session,
          paragraphs: ps,
          pf: projectAtStart,
          onDisk: doc.onDisk,
          pfDirty: pfDirtyRef.current,
          format: doc.format,
          audioName: loaded.audioName,
          textName: doc.textName,
          metaName: doc.metaName,
          rawName: doc.rawName,
          existingNames: existing,
          strict: import.meta.env?.DEV === true,
          force,
        });
        if (!out.ok) {
          if (out.kind === "conflict") {
            setConflict({ file: out.file, confirmReload: false });
          } else {
            const reason = (out.error as StorageError).code;
            setSaveError(t("status.saveFailed", { file: out.file, reason }));
          }
          return false;
        }
        docRef.current = {
          format: out.format,
          textName: out.textName,
          metaName: out.metaName,
          rawName: out.rawName,
          onDisk: out.onDisk,
        };
        if (out.pf !== projectAtStart) {
          pfRef.current = out.pf;
          setPfState(out.pf);
        }
        pfDirtyRef.current = false;
        if (paragraphsRef.current === ps && pfRef.current === out.pf) setDirty(false);
        setSaveError(null);
        setConflict(null);
        const time = new Date().toLocaleTimeString();
        setStatus(
          out.projectCreated
            ? t("status.savedProjectCreated", { time })
            : t("status.saved", { time }),
        );
        say("toast.saved");
        return true;
      } catch (e) {
        setSaveError(t("status.saveFailed", { file: docRef.current.textName, reason: String(e) }));
        return false;
      } finally {
        savingRef.current = false;
      }
    },
    [loaded.session, loaded.audioName, say, setDirty, t],
  );

  // ---- leaving the project: Guardar / Descartar / Cancelar ----
  const guard = useCallback(
    (kind: Leave["kind"], run: () => void, cancel?: () => void) => {
      if (!dirtyRef.current) {
        run();
        return;
      }
      setLeave({ kind, run, cancel });
      if (kind === "close") void host.lifecycle.closeDialogOpen(true);
    },
    [host],
  );

  const resolveLeave = useCallback(
    async (choice: "save" | "discard" | "cancel") => {
      const l = leave;
      if (!l) return;
      if (choice === "cancel") {
        setLeave(null);
        l.cancel?.();
        return;
      }
      if (choice === "save") {
        const ok = await save();
        if (!ok) {
          setLeave(null);
          l.cancel?.();
          return;
        }
      }
      setLeave(null);
      l.run();
    },
    [leave, save],
  );

  // ---- host events ----
  useEffect(() => {
    const offClose = host.lifecycle.onCloseRequested(() => {
      persistSession();
      guard(
        "close",
        () => void host.lifecycle.respondToClose(true),
        () => void host.lifecycle.respondToClose(false),
      );
    });
    const offMenu = host.lifecycle.onMenuCommand((c: MenuCommand) => {
      if (c === "save") void save();
      else if (c === "open-folder") guard("open", onPick);
      else if (c === "show-help") setHelpOpen(true);
      else if (c === "toggle-sidebar") toggleSidebar();
      else if (c === "check-updates") void host.updates.check();
    });
    const offUpdates = host.updates.onStatus((s) => {
      setUpdate(s);
      if (s.state === "none") say("update.none");
      else if (s.state === "error") say("update.error");
    });
    return () => {
      offClose();
      offMenu();
      offUpdates();
    };
    // handlers read refs; re-subscribe only when the identities below change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host, save, guard, onPick, persistSession]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((v) => {
      void host.settings.update({ sidebarCollapsed: v });
      return !v;
    });
  }, [host]);

  const setAutoScroll = (v: boolean) => {
    autoScrollRef.current = v;
    setAutoScrollState(v);
    void host.settings.update({ autoScroll: v });
  };

  useHotkeys({
    save: () => void save(),
    togglePlay: player.togglePlay,
    back5: () => player.nudge(-5),
    fwd5: () => player.nudge(5),
    paragraphStart: player.paragraphStart,
    nextParagraph: player.nextParagraph,
    audioStart: player.audioStart,
    markVerified: markActiveVerified,
    speedDown: () => player.stepSpeed(-1),
    speedUp: () => player.stepSpeed(1),
  });

  useEffect(() => {
    document.title = `${pf?.titulo || loaded.ref.displayName} · ${t("app.title")}`;
  }, [pf?.titulo, loaded.ref.displayName, t]);

  // ---- derived ----
  const labels = useMemo(() => labelsInOrder(paragraphs), [paragraphs]);
  const info = useMemo(() => buildSpeakerInfo(paragraphs, pf ?? emptyProject()), [paragraphs, pf]);
  const colorText = pf ? pf.visualizacion.colorearTexto : false;
  const panelMode = pf ? "edit" : "readonly";
  const createProject = () => {
    const created: ProjectFile = {
      ...defaultProject(labels),
      titulo: loaded.ref.displayName,
      archivos: {
        audio: loaded.audioName,
        texto: docRef.current.textName,
        ...(docRef.current.metaName ? { meta: docRef.current.metaName } : {}),
        ...(docRef.current.rawName ? { crudo: docRef.current.rawName } : {}),
      },
    };
    docRef.current = { ...docRef.current, onDisk: false };
    changeProject(created);
    setProjectOpen(true);
  };

  const warnings = loaded.warnings.map((w) => {
    const params: Params = {};
    for (const [k, v] of Object.entries(w))
      if (typeof v === "number" || typeof v === "string") params[k] = v;
    if (w.code === "non_monotonic_times") params.n = w.firstIndex + 1;
    return t(`warning.${w.code}`, params);
  });

  return (
    <div className="app">
      <header className="topbar">
        <div className="row">
          <button
            className="icon-btn"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? t("topbar.hideSidebar") : t("topbar.showSidebar")}
            aria-expanded={sidebarOpen}
            title={t("topbar.sidebar")}
          >
            <IcMenu />
          </button>
          <h1>{t("app.title")}</h1>
          <span className="sesion-name" title={loaded.ref.displayPath ?? loaded.ref.displayName}>
            {loaded.ref.displayName}
          </span>
          {pf?.titulo && (
            <span className="proy-tit" title={pf.descripcion || pf.titulo}>
              {pf.titulo}
            </span>
          )}
          {!pf && <span className="badge">{t("topbar.noProject")}</span>}
          {pf && !docRef.current.onDisk && (
            <span className="badge">{t("topbar.projectUnsaved")}</span>
          )}
          <div className="spacer"></div>
          <span className="status truncate" title={saveError ?? status} role="status">
            {saveError ?? status}
          </span>
          {saveError && <button onClick={() => void save()}>{t("status.retry")}</button>}
          <label
            className="status"
            style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}
          >
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            {t("topbar.autoScroll")}
          </label>
          <button onClick={() => guard("open", onPick)}>{t("topbar.open")}</button>
          <button onClick={() => guard("reload", onReload)}>{t("topbar.reload")}</button>
          <button className="primary" onClick={() => void save()} disabled={!dirty}>
            {t("topbar.save")}
            {dirty ? " *" : ""}
          </button>
          <button
            className="icon-btn"
            onClick={() => setProjectOpen(true)}
            aria-label={t("topbar.projectAria")}
            aria-haspopup="dialog"
            title={t("topbar.projectTitle")}
            disabled={!pf}
          >
            <IcPersonas />
          </button>
          <button
            className="icon-btn"
            onClick={() => setHelpOpen(true)}
            aria-label={t("topbar.helpAria")}
            aria-haspopup="dialog"
            title={t("topbar.helpTitle")}
            style={{ fontWeight: 700, fontSize: 15 }}
          >
            ?
          </button>
        </div>
        <Transport
          mediaRef={mediaRef}
          platform={host.platform}
          onToggle={player.togglePlay}
          onNudge={player.nudge}
          onPrev={player.paragraphStart}
          onNext={player.nextParagraph}
          rate={player.rate}
          onRate={player.setRate}
        />
        {/* The transcript on screen is the text alternative for the audio. */}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio
          ref={mediaRef}
          src={loaded.audioUrl}
          preload="auto"
          onError={() => setAudioError(true)}
          onLoadedMetadata={() => setAudioError(false)}
        />
      </header>

      <div className="workarea">
        <aside
          className={"sidebar" + (sidebarOpen ? "" : " cerrada")}
          aria-label={t("sidebar.label")}
        >
          <div className="sb-sec">
            <h2>{t("sidebar.project")}</h2>
            <ProjectPanel
              pf={pf}
              mode={panelMode}
              labels={labels}
              folderName={loaded.ref.displayName}
              onEdit={() => setProjectOpen(true)}
              onCreate={createProject}
              onViewJson={() => setJsonOpen(true)}
            />
          </div>
          <Section title={t("sidebar.map")}>
            <Minimap
              paragraphs={paragraphs}
              activeId={activeId}
              mediaRef={mediaRef}
              info={info}
              onGo={goToLine}
            />
          </Section>
          {update.state === "available" && (
            <div className="sb-sec">
              <div className="sb-msg">{t("update.available", { version: update.version })}</div>
              <button onClick={() => void host.external.open(update.url)}>
                {t("update.open")}
              </button>
            </div>
          )}
        </aside>

        <main>
          {audioError && (
            <div className="banner error" role="alert">
              {t("banner.audioError")}
            </div>
          )}
          {warnings.map((w, i) => (
            <div className="banner" key={i} role="status">
              {w}
            </div>
          ))}
          {paragraphs.length === 0 ? (
            <div className="empty">
              <p>{t("empty.noParagraphs")}</p>
            </div>
          ) : (
            <Transcript
              paragraphs={paragraphs}
              activeId={activeId}
              info={info}
              colorText={colorText}
              onSeek={player.seekTo}
              onCycle={cycleLine}
              onEdit={editLine}
              register={register}
            />
          )}
        </main>
      </div>

      <footer className="statsbar" aria-label={t("stats.aria")}>
        <StatsWidget paragraphs={paragraphs} mediaRef={mediaRef} info={info} />
      </footer>
      <Toast message={toast.message} />

      {helpOpen && (
        <HelpModal
          platform={host.platform}
          onClose={() => setHelpOpen(false)}
          onLanguage={(l) => {
            onLanguage(l);
          }}
        />
      )}
      {projectOpen && pf && (
        <ProjectModal
          pf={pf}
          labels={labels}
          mod={mod}
          onChange={changeProject}
          onClose={() => setProjectOpen(false)}
          onViewJson={() => {
            setProjectOpen(false);
            setJsonOpen(true);
          }}
        />
      )}
      {jsonOpen && (
        <JsonView
          title={t("json.title")}
          initialText={serializeProject(
            pf ?? {
              ...emptyProject(),
              archivos: { audio: loaded.audioName, texto: docRef.current.textName },
            },
          )}
          onCancel={() => setJsonOpen(false)}
          onApply={(next) => {
            changeProject(next);
            setJsonOpen(false);
          }}
        />
      )}
      {leave && (
        <Dialog
          title={t("leave.title")}
          onClose={() => void resolveLeave("cancel")}
          labelId="leave-titulo"
          modalStrict
        >
          <p>{t("leave.text")}</p>
          <div className="dialog-acciones">
            <button onClick={() => void resolveLeave("cancel")}>{t("common.cancel")}</button>
            <button onClick={() => void resolveLeave("discard")}>{t("leave.discard")}</button>
            <button className="primary" onClick={() => void resolveLeave("save")} data-autofocus>
              {t("leave.save")}
            </button>
          </div>
        </Dialog>
      )}
      {conflict && (
        <Dialog
          title={t("conflict.title")}
          onClose={() => setConflict(null)}
          labelId="conflict-titulo"
          modalStrict
        >
          <p>{t("conflict.text", { file: conflict.file })}</p>
          {conflict.confirmReload && <p className="error">{t("conflict.reloadConfirm")}</p>}
          <div className="dialog-acciones">
            <button onClick={() => setConflict(null)} data-autofocus>
              {t("common.cancel")}
            </button>
            <button
              onClick={() => {
                if (!conflict.confirmReload) setConflict({ ...conflict, confirmReload: true });
                else {
                  setConflict(null);
                  setDirty(false);
                  onReload();
                }
              }}
            >
              {t("conflict.reload")}
            </button>
            <button className="primary" onClick={() => void save(true)}>
              {t("conflict.overwrite")}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
