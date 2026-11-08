import { useMemo, useState } from "react";
import { parseProjectFile, type ProjectFile } from "@transcript-editor/core";
import { Dialog } from "../components/Dialog";
import { useT } from "../i18n/I18n";

interface Props {
  title: string;
  initialText: string;
  /** Parse error of the original text, shown until the user edits. */
  initialError?: string | null;
  onApply: (project: ProjectFile) => void;
  onCancel: () => void;
}

/** Raw proyecto.json view with live validation. Apply is enabled only while the text is valid. */
export function JsonView({ title, initialText, initialError, onApply, onCancel }: Props) {
  const t = useT();
  const [text, setText] = useState(initialText);
  const result = useMemo(() => {
    try {
      const parsed = parseProjectFile(JSON.parse(text));
      if ("error" in parsed) return { error: t("json.notObject"), project: null, warnings: [] };
      return { error: null, project: parsed.project, warnings: parsed.warnings };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e), project: null, warnings: [] };
    }
  }, [text, t]);
  const error = result.error;
  const shownError = text === initialText && initialError ? initialError : error;
  return (
    <Dialog title={title} onClose={onCancel} wide labelId="json-titulo">
      <label className="campo" htmlFor="json-text">
        {t("json.label")}
      </label>
      <textarea
        id="json-text"
        className="json"
        value={text}
        spellCheck={false}
        onChange={(e) => setText(e.target.value)}
        aria-invalid={shownError ? "true" : "false"}
        aria-describedby={shownError ? "json-error" : undefined}
      />
      {shownError && (
        <div id="json-error" className="error" role="alert">
          {shownError}
        </div>
      )}
      {!error && result.warnings.length > 0 && (
        <ul className="avisos">
          {result.warnings.map((w, i) => (
            <li key={i}>{t(`projectWarning.${w.code}`)}</li>
          ))}
        </ul>
      )}
      <div className="dialog-acciones">
        <button onClick={onCancel}>{t("common.cancel")}</button>
        <button
          className="primary"
          disabled={error !== null || result.project === null}
          onClick={() => result.project && onApply(result.project)}
        >
          {t("json.apply")}
        </button>
      </div>
    </Dialog>
  );
}
