import type { ProjectRef } from "@transcript-editor/storage";
import { useT } from "../i18n/I18n";

interface Props {
  recents: ProjectRef[];
  canOpenSample: boolean;
  busy: boolean;
  onPick: () => void;
  onOpenSample: () => void;
  onOpenRecent: (ref: ProjectRef) => void;
  onRemoveRecent: (ref: ProjectRef) => void;
  onClearRecents: () => void;
}

/** Start screen: open a folder, open the demo, recent projects. */
export function Welcome({
  recents,
  canOpenSample,
  busy,
  onPick,
  onOpenSample,
  onOpenRecent,
  onRemoveRecent,
  onClearRecents,
}: Props) {
  const t = useT();
  return (
    <div className="welcome">
      <h1>{t("app.title")}</h1>
      <p>{t("welcome.tagline")}</p>
      <div className="acciones">
        <button className="primary" onClick={onPick} disabled={busy} data-autofocus>
          {t("welcome.open")}
        </button>
        {canOpenSample && (
          <button onClick={onOpenSample} disabled={busy}>
            {t("welcome.sample")}
          </button>
        )}
      </div>
      <p className="sb-msg">{t("welcome.privacy")}</p>
      {recents.length > 0 && (
        <section aria-labelledby="recientes-titulo">
          <h2 id="recientes-titulo" className="sb-tit" style={{ cursor: "default" }}>
            {t("welcome.recents")}
          </h2>
          <ul className="recientes">
            {recents.map((r) => (
              <li key={r.key}>
                <button className="abrir" onClick={() => onOpenRecent(r)} disabled={busy}>
                  {r.displayName}
                  <span className="ruta">{r.displayPath}</span>
                </button>
                <button
                  onClick={() => onRemoveRecent(r)}
                  aria-label={t("welcome.remove", { name: r.displayName })}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <button onClick={onClearRecents} style={{ marginTop: 8 }}>
            {t("welcome.clear")}
          </button>
        </section>
      )}
    </div>
  );
}
