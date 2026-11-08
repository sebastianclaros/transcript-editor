import { Fragment } from "react";
import {
  ESTADOS,
  HOTKEYS,
  formatHotkey,
  type Language,
  type MessageKey,
} from "@transcript-editor/core";
import type { HostApi } from "@transcript-editor/storage";
import { Dialog } from "../components/Dialog";
import { useLanguage, useT } from "../i18n/I18n";

interface Props {
  platform: HostApi["platform"];
  onClose: () => void;
  onLanguage?: (lang: Language) => void;
}

const KEY_LABEL: Record<string, MessageKey> = {
  Space: "help.key.space",
  Shift: "help.key.shift",
  Home: "help.key.home",
};

/** Renders a combo like `Mod+Shift+Space` as <kbd> chips with platform-aware Mod. */
function Combo({ combo, platform }: { combo: string | null; platform: HostApi["platform"] }) {
  const t = useT();
  if (!combo) return <>—</>;
  const parts = formatHotkey(combo, platform).split("+");
  // "Mod+Shift+," ends with a "+"-free key; a literal plus never appears in the table.
  return (
    <>
      {parts.map((k, i) => (
        <Fragment key={i}>
          {i > 0 && "+"}
          <kbd>{KEY_LABEL[k] ? t(KEY_LABEL[k]) : k}</kbd>
        </Fragment>
      ))}
    </>
  );
}

/** Help: state colours, hotkeys (Ctrl or Cmd), platform note and the language selector. */
export function HelpModal({ platform, onClose, onLanguage }: Props) {
  const t = useT();
  const lang = useLanguage();
  const mac = platform === "darwin";
  return (
    <Dialog title={t("help.title")} onClose={onClose} labelId="ayuda-titulo">
      <h3>{t("help.states")}</h3>
      {ESTADOS.map((e) => (
        <div className="fila" key={e}>
          <span className="dot" style={{ background: `var(--est-${e})` }}></span>
          {t(`help.estado.${e}`)}
        </div>
      ))}
      <div className="fila" style={{ color: "var(--muted)", fontSize: 12 }}>
        {t("help.doubleClick")}
      </div>
      <h3>
        {t("help.hotkeys")}
        {mac ? ` ${t("help.cmdNote")}` : ""}
      </h3>
      <div className="atajo">
        <span className="cab">{t("help.action")}</span>
        <span className="cab">{t("help.primary")}</span>
        <span className="cab">{t("help.alternative")}</span>
        {HOTKEYS.map((h) => (
          <Fragment key={h.action}>
            <span>{t(`hotkey.${h.action}`)}</span>
            <span>
              <Combo combo={h.primary} platform={platform} />
            </span>
            <span>
              <Combo combo={h.alternative} platform={platform} />
            </span>
          </Fragment>
        ))}
      </div>
      <div
        className="fila"
        style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.5, marginTop: 8 }}
      >
        {mac ? t("help.noteMac") : t("help.noteOther")}
      </div>
      {onLanguage && (
        <>
          <h3>{t("help.language")}</h3>
          <label className="opciones">
            <span className="sr-only">{t("help.language")}</span>
            <select value={lang} onChange={(e) => onLanguage(e.target.value as Language)}>
              <option value="es">Español</option>
              <option value="en">English</option>
            </select>
          </label>
        </>
      )}
      <div className="dialog-acciones">
        <button onClick={onClose} data-autofocus>
          {t("common.close")}
        </button>
      </div>
    </Dialog>
  );
}
