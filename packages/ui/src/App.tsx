import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  defaultConfig,
  isLanguage,
  languageFromLocale,
  type Language,
} from "@transcript-editor/core";
import {
  LocalFsProvider,
  type HostApi,
  type ProjectRef,
  type SettingsView,
  type StorageProvider,
} from "@transcript-editor/storage";
import "./styles/theme.css";
import "./styles/app.css";
import { Editor } from "./Editor";
import { Toast, useToast } from "./components/useToast";
import { I18nProvider, useT } from "./i18n/I18n";
import { AskCreateDialog, DamagedDialog, MappingDialog } from "./project/dialogs";
import { JsonView } from "./project/JsonView";
import { Welcome } from "./project/Welcome";
import { useOpenFlow } from "./project/useOpenFlow";

export interface AppProps {
  host: HostApi;
  provider?: StorageProvider;
}

/** Root component: loads settings, then shows the welcome screen, the open-flow dialogs or the editor. */
export function App({ host, provider }: AppProps) {
  const store = useMemo(() => provider ?? new LocalFsProvider(host), [provider, host]);
  const [settings, setSettings] = useState<SettingsView | null>(null);
  const [language, setLanguage] = useState<Language>("es");

  useEffect(() => {
    let live = true;
    void (async () => {
      const [s, info] = await Promise.all([host.settings.get(), host.app.getInfo()]);
      if (!live) return;
      if (s.ok) {
        setSettings(s.value);
        setLanguage(
          isLanguage(s.value.language)
            ? s.value.language
            : languageFromLocale(info.ok ? info.value.locale : undefined),
        );
      } else {
        // Without settings the app still works with defaults.
        setLanguage(languageFromLocale(info.ok ? info.value.locale : undefined));
        setSettings({ ...defaultConfig(), recovered: false });
      }
    })();
    return () => {
      live = false;
    };
  }, [host]);

  const changeLanguage = useCallback(
    (lang: Language) => {
      setLanguage(lang);
      void host.settings.update({ language: lang });
    },
    [host],
  );

  return (
    <I18nProvider language={language}>
      {settings ? (
        <Shell host={host} store={store} settings={settings} onLanguage={changeLanguage} />
      ) : null}
    </I18nProvider>
  );
}

function Shell({
  host,
  store,
  settings: initial,
  onLanguage,
}: {
  host: HostApi;
  store: StorageProvider;
  settings: SettingsView;
  onLanguage: (l: Language) => void;
}) {
  const t = useT();
  const toast = useToast(4000);
  const { state, dispatch, ignoreDamaged } = useOpenFlow(store);
  const [settings, setSettings] = useState(initial);
  const [recents, setRecents] = useState<ProjectRef[]>([]);
  const restoring = useRef<string | null>(null);
  const started = useRef(false);

  const refreshRecents = useCallback(async () => {
    try {
      setRecents(await store.listRecent());
    } catch {
      setRecents([]);
    }
  }, [store]);

  // Startup: damaged-config notice, then restore the last project.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (initial.recovered) toast.show(t("toast.configRecovered"));
    void refreshRecents();
    const last = initial.lastProject;
    if (last) {
      restoring.current = last.key;
      dispatch({
        t: "OPEN",
        project: {
          providerId: store.id,
          key: last.key,
          displayName: last.name,
          displayPath: last.path,
        },
      });
    }
    // run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.s === "welcome") {
      void refreshRecents();
      void host.settings.get().then((r) => r.ok && setSettings(r.value));
    }
    if (state.s === "ready" || state.s === "loading") restoring.current = null;
    if (state.s === "failed") {
      const code = state.error.code;
      if (restoring.current && (code === "not_found" || code === "invalid_argument")) {
        void host.recents.remove(restoring.current);
        toast.show(t("error.lastFolderMissing"));
      } else if (code === "invalid_argument") toast.show(t("error.folderNotAllowed"));
      else if (code === "not_found") toast.show(t("error.folderNotFound"));
      else toast.show(t("error.generic", { code }));
      restoring.current = null;
      dispatch({ t: "DISMISS" });
    }
    // toast.show is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, host, dispatch]);

  // Menu commands and close requests while no project is open.
  useEffect(() => {
    const offMenu = host.lifecycle.onMenuCommand((c) => {
      if (c === "open-folder" && stateRef.current.s === "welcome") dispatch({ t: "PICK" });
      if (c === "check-updates") void host.updates.check();
    });
    const offClose = host.lifecycle.onCloseRequested(() => {
      if (stateRef.current.s !== "ready") void host.lifecycle.respondToClose(true);
    });
    return () => {
      offMenu();
      offClose();
    };
  }, [host, dispatch]);
  const stateRef = useRef(state);
  stateRef.current = state;

  const openSample = useCallback(async () => {
    try {
      const ref = await store.openSample?.();
      if (ref) dispatch({ t: "OPEN", project: ref });
    } catch {
      toast.show(t("error.sampleFailed"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, dispatch, t]);

  const removeRecent = async (ref: ProjectRef) => {
    await store.forget?.(ref);
    await refreshRecents();
  };
  const clearRecents = async () => {
    await host.recents.clear();
    await refreshRecents();
  };

  const busy = state.s === "picking" || state.s === "resolving" || state.s === "loading";

  const shown = state.s === "ready" ? state : state.s === "picking" ? state.from : null;
  if (shown) {
    return (
      <>
        <Editor
          key={shown.project.key + ":" + shown.loaded.audioUrl}
          host={host}
          loaded={shown.loaded}
          settings={settings}
          onLanguage={onLanguage}
          onPick={() => dispatch({ t: "PICK" })}
          onReload={() => dispatch({ t: "OPEN", project: shown.project })}
        />
        <Toast message={toast.message} />
      </>
    );
  }
  return (
    <>
      <Welcome
        recents={recents}
        canOpenSample={Boolean(store.openSample)}
        busy={busy}
        onPick={() => dispatch({ t: "PICK" })}
        onOpenSample={() => void openSample()}
        onOpenRecent={(project) => dispatch({ t: "OPEN", project })}
        onRemoveRecent={(r) => void removeRecent(r)}
        onClearRecents={() => void clearRecents()}
      />
      {busy && (
        <div className="welcome sb-msg" role="status">
          {t("welcome.loading")}
        </div>
      )}
      {state.s === "askCreate" && (
        <AskCreateDialog
          detected={state.detected}
          onCreate={() => dispatch({ t: "CREATE" })}
          onContinue={() => dispatch({ t: "CONTINUE" })}
          onCancel={() => dispatch({ t: "CANCEL" })}
        />
      )}
      {state.s === "projectDamaged" && (
        <DamagedDialog
          parseError={state.parseError}
          onView={() => dispatch({ t: "DAMAGED_VIEW" })}
          onIgnore={() => void ignoreDamaged()}
          onCancel={() => dispatch({ t: "CANCEL" })}
        />
      )}
      {state.s === "jsonView" && (
        <JsonView
          title={t("json.title")}
          initialText={state.rawText}
          initialError={state.parseError}
          onCancel={() => dispatch({ t: "JSON_CANCEL" })}
          onApply={(pf) => dispatch({ t: "JSON_APPLY", pf })}
        />
      )}
      {state.s === "mapping" && (
        <MappingDialog
          files={state.files}
          draft={state.draft}
          reason={state.reason}
          createProject={state.createProject}
          missing={state.missing}
          onConfirm={(draft, save) => dispatch({ t: "MAP_CONFIRM", draft, save })}
          onCancel={() => dispatch({ t: "CANCEL" })}
        />
      )}
      <Toast message={toast.message} />
    </>
  );
}
