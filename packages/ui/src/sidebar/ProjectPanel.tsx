import type { ProjectFile } from "@transcript-editor/core";
import { useT } from "../i18n/I18n";

interface Props {
  pf: ProjectFile | null;
  mode: "edit" | "readonly";
  labels: string[];
  folderName: string;
  onEdit: () => void;
  onCreate: () => void;
  onViewJson: () => void;
}

/** Sidebar project summary. `readonly` mode (no proyecto.json) never lets fields be edited. */
export function ProjectPanel({
  pf,
  mode,
  labels,
  folderName,
  onEdit,
  onCreate,
  onViewJson,
}: Props) {
  const t = useT();
  if (!pf || mode === "readonly") {
    const found = labels.filter((l) => l !== "");
    return (
      <>
        <div className="proy-nombre">{folderName}</div>
        <div className="sb-msg" style={{ marginBottom: 8 }}>
          {t("sidebar.noProject")}
        </div>
        {found.length > 0 && (
          <div className="leyenda" aria-label={t("mapa.speakers")}>
            {found.map((l) => (
              <span className="chip" key={l}>
                <span>{l}</span>
              </span>
            ))}
          </div>
        )}
        <button style={{ marginTop: 8 }} onClick={onCreate}>
          {t("sidebar.createProject")}
        </button>
      </>
    );
  }
  return (
    <>
      <div className="proy-nombre">{pf.titulo || folderName}</div>
      {pf.descripcion && (
        <div className="proy-desc" title={pf.descripcion}>
          {pf.descripcion}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button onClick={onEdit}>{t("sidebar.editProject")}</button>
        <button onClick={onViewJson}>{t("project.viewJson")}</button>
      </div>
    </>
  );
}
