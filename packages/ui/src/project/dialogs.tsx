import { useState } from "react";
import { validateFileName, type ProjectFile } from "@transcript-editor/core";
import type { DetectedFiles } from "@transcript-editor/core";
import type { FileEntry } from "@transcript-editor/storage";
import { Dialog } from "../components/Dialog";
import { useT } from "../i18n/I18n";
import type { MappingReason } from "./openFlow";

export function AskCreateDialog({
  detected,
  onCreate,
  onContinue,
  onCancel,
}: {
  detected: DetectedFiles;
  onCreate: () => void;
  onContinue: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  return (
    <Dialog title={t("askCreate.title")} onClose={onCancel} labelId="ask-titulo">
      <p>{t("askCreate.text")}</p>
      {(detected.audio || detected.texto) && (
        <p className="sb-msg">
          {t("askCreate.detected", {
            audio: detected.audio ?? "—",
            texto: detected.texto ?? "—",
          })}
        </p>
      )}
      <div className="dialog-acciones">
        <button onClick={onCancel}>{t("common.cancel")}</button>
        <button onClick={onContinue}>{t("askCreate.continue")}</button>
        <button className="primary" onClick={onCreate} data-autofocus>
          {t("askCreate.create")}
        </button>
      </div>
    </Dialog>
  );
}

export function DamagedDialog({
  parseError,
  onView,
  onIgnore,
  onCancel,
}: {
  parseError: string;
  onView: () => void;
  onIgnore: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  return (
    <Dialog title={t("damaged.title")} onClose={onCancel} labelId="damaged-titulo" modalStrict>
      <p>{t("damaged.text")}</p>
      <p className="error">{parseError}</p>
      <div className="dialog-acciones">
        <button onClick={onCancel} data-autofocus>
          {t("common.cancel")}
        </button>
        <button onClick={onIgnore}>{t("damaged.ignore")}</button>
        <button className="primary" onClick={onView}>
          {t("damaged.view")}
        </button>
      </div>
    </Dialog>
  );
}

function FileSelect({
  id,
  label,
  value,
  options,
  optional,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: FileEntry[];
  optional?: boolean;
  onChange: (v: string) => void;
}) {
  const t = useT();
  return (
    <>
      <label className="campo" htmlFor={id}>
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{optional ? t("mapping.none") : t("mapping.choose")}</option>
        {options.map((f) => (
          <option key={f.name} value={f.name}>
            {f.name}
          </option>
        ))}
      </select>
    </>
  );
}

export function MappingDialog({
  files,
  draft,
  reason,
  createProject,
  missing,
  onConfirm,
  onCancel,
}: {
  files: FileEntry[];
  draft: ProjectFile;
  reason: MappingReason;
  createProject: boolean;
  missing: string[];
  onConfirm: (draft: ProjectFile, save: boolean) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [audio, setAudio] = useState(draft.archivos.audio ?? "");
  const [texto, setTexto] = useState(draft.archivos.texto ?? "");
  const [meta, setMeta] = useState(draft.archivos.meta ?? "");
  const [save, setSave] = useState(true);
  const have = new Set(files.map((f) => f.name));
  const valid =
    audio !== "" &&
    texto !== "" &&
    validateFileName(audio).ok &&
    validateFileName(texto).ok &&
    have.has(audio) &&
    have.has(texto) &&
    (meta === "" || (validateFileName(meta).ok && have.has(meta)));
  const metaOptions = files.filter(
    (f) => f.kind === "json" && !/^proyecto(\.bak(-\d+)?)?\.json$/i.test(f.name),
  );
  const confirm = () => {
    const archivos = { ...draft.archivos, audio, texto };
    if (meta) archivos.meta = meta;
    else delete archivos.meta;
    onConfirm({ ...draft, archivos }, createProject || save);
  };
  return (
    <Dialog title={t("mapping.title")} onClose={onCancel} wide labelId="mapping-titulo">
      <p>{t(`mapping.reason.${reason}`)}</p>
      {missing.length > 0 && (
        <ul className="avisos">
          {missing.map((m) => (
            <li key={m}>{t("mapping.missing", { name: m })}</li>
          ))}
        </ul>
      )}
      <FileSelect
        id="map-audio"
        label={t("mapping.audio")}
        value={audio}
        options={files.filter((f) => f.kind === "audio")}
        onChange={setAudio}
      />
      <FileSelect
        id="map-texto"
        label={t("mapping.text")}
        value={texto}
        options={files.filter((f) => f.kind === "text")}
        onChange={setTexto}
      />
      <FileSelect
        id="map-meta"
        label={t("mapping.meta")}
        value={meta}
        options={metaOptions}
        optional
        onChange={setMeta}
      />
      <div className="opciones" style={{ marginTop: 12 }}>
        <label>
          <input
            type="checkbox"
            checked={createProject || save}
            disabled={createProject}
            onChange={(e) => setSave(e.target.checked)}
          />
          {t("mapping.save")}
        </label>
      </div>
      <div className="dialog-acciones">
        <button onClick={onCancel}>{t("common.cancel")}</button>
        <button className="primary" disabled={!valid} onClick={confirm}>
          {t("mapping.open")}
        </button>
      </div>
    </Dialog>
  );
}
