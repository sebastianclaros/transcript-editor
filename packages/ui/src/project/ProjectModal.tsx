import { PALETA, type ProjectFile, type SpeakerEntry } from "@transcript-editor/core";
import { Dialog } from "../components/Dialog";
import { useT } from "../i18n/I18n";

interface Props {
  pf: ProjectFile;
  /** Speaker labels found in the text, in order of first appearance. */
  labels: string[];
  mod: string;
  onChange: (pf: ProjectFile) => void;
  onClose: () => void;
  onViewJson: () => void;
}

interface Row {
  sp: SpeakerEntry;
  inFile: boolean;
  present: boolean;
}

/**
 * Project editor: title, description, speakers (label, full name, initials, colour) and display
 * options. Labels found in the text but missing from the file appear as extra rows ("sin guardar");
 * the first edit persists every displayed row.
 */
export function ProjectModal({ pf, labels, mod, onChange, onClose, onViewJson }: Props) {
  const t = useT();
  const known = new Set(pf.speakers.map((s) => s.id));
  const extras = labels.filter((l) => l !== "" && !known.has(l));
  const rows: Row[] = [
    ...pf.speakers.map((sp) => ({ sp, inFile: true, present: labels.includes(sp.id) })),
    ...extras.map((id, i) => ({
      sp: {
        id,
        nombre: "",
        iniciales: "",
        color: PALETA[(pf.speakers.length + i) % PALETA.length] ?? null,
      },
      inFile: false,
      present: true,
    })),
  ];
  const set = (patch: Partial<ProjectFile>) => onChange({ ...pf, ...patch });
  const setVis = (patch: Partial<ProjectFile["visualizacion"]>) =>
    set({ visualizacion: { ...pf.visualizacion, ...patch } });
  const setRow = (row: Row, patch: Partial<SpeakerEntry>) => {
    const speakers = rows.map((r) => (r.sp.id === row.sp.id ? { ...r.sp, ...patch } : r.sp));
    set({ speakers });
  };
  const remove = (id: string) => set({ speakers: pf.speakers.filter((x) => x.id !== id) });
  return (
    <Dialog title={t("project.title")} onClose={onClose} wide labelId="proy-titulo">
      <label className="campo" htmlFor="pj-titulo">
        {t("project.name")}
      </label>
      <input
        id="pj-titulo"
        type="text"
        value={pf.titulo}
        onChange={(e) => set({ titulo: e.target.value })}
      />
      <label className="campo" htmlFor="pj-desc">
        {t("project.description")}
      </label>
      <textarea
        id="pj-desc"
        value={pf.descripcion}
        onChange={(e) => set({ descripcion: e.target.value })}
      />
      <h3>{t("project.speakers")}</h3>
      {rows.length === 0 ? (
        <div className="sb-msg">{t("project.noSpeakers")}</div>
      ) : (
        <table className="tabla-spk">
          <thead>
            <tr>
              <th>{t("project.label")}</th>
              <th>{t("project.fullName")}</th>
              <th>{t("project.initials")}</th>
              <th>{t("project.color")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.sp.id} data-id={r.sp.id}>
                <td
                  className="id"
                  title={r.present ? t("project.labelInText") : t("project.labelNotInText")}
                >
                  {r.sp.id}
                  {!r.inFile && <span className="sb-msg"> ({t("project.unsaved")})</span>}
                </td>
                <td>
                  <input
                    type="text"
                    aria-label={t("project.fullNameOf", { id: r.sp.id })}
                    value={r.sp.nombre}
                    onChange={(e) => setRow(r, { nombre: e.target.value })}
                  />
                </td>
                <td style={{ width: 90 }}>
                  <input
                    type="text"
                    aria-label={t("project.initialsOf", { id: r.sp.id })}
                    value={r.sp.iniciales}
                    onChange={(e) => setRow(r, { iniciales: e.target.value })}
                  />
                </td>
                <td>
                  <div className="col">
                    <input
                      type="color"
                      aria-label={t("project.colorOf", { id: r.sp.id })}
                      value={r.sp.color || "#888888"}
                      onChange={(e) => setRow(r, { color: e.target.value })}
                    />
                    <button onClick={() => setRow(r, { color: null })} disabled={!r.sp.color}>
                      {t("project.noColor")}
                    </button>
                  </div>
                </td>
                <td>
                  {r.inFile && !r.present && (
                    <button
                      onClick={() => remove(r.sp.id)}
                      aria-label={t("project.removeOf", { id: r.sp.id })}
                    >
                      {t("project.remove")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h3>{t("project.display")}</h3>
      <div className="opciones">
        <label>
          {t("project.showAs")}
          <select
            value={pf.visualizacion.mostrar ?? ""}
            onChange={(e) =>
              setVis({
                mostrar: (e.target.value || undefined) as ProjectFile["visualizacion"]["mostrar"],
              })
            }
          >
            <option value="">{t("project.showAuto")}</option>
            <option value="etiqueta">{t("project.showLabel")}</option>
            <option value="iniciales">{t("project.showInitials")}</option>
            <option value="nombre">{t("project.showName")}</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={pf.visualizacion.colorearTexto}
            onChange={(e) => setVis({ colorearTexto: e.target.checked })}
          />
          {t("project.colorText")}
        </label>
      </div>
      <div className="sb-msg" style={{ marginTop: 10 }}>
        {t("project.saveHint", { mod })}
      </div>
      <div className="dialog-acciones">
        <button onClick={onViewJson}>{t("project.viewJson")}</button>
        <button onClick={onClose} data-autofocus>
          {t("common.close")}
        </button>
      </div>
    </Dialog>
  );
}
