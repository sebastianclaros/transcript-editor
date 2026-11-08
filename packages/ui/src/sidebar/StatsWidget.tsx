import { useMemo, type RefObject } from "react";
import {
  GRIS,
  computeStats,
  fmt,
  pct,
  type Paragraph,
  type SpeakerInfo,
} from "@transcript-editor/core";
import { useT } from "../i18n/I18n";
import { useDuration } from "../player/useDuration";

const FALLBACK = ["#7fd1ff", "#ffc47f"];

interface Props {
  paragraphs: Paragraph[];
  mediaRef: RefObject<HTMLMediaElement | null>;
  info: SpeakerInfo;
}

/** Per-speaker words, % of text, paragraphs, estimated speaking time and %, stacked bar, totals. */
export function StatsWidget({ paragraphs, mediaRef, info }: Props) {
  const t = useT();
  const dur = useDuration(mediaRef);
  const st = useMemo(() => computeStats(paragraphs, dur), [paragraphs, dur]);
  if (paragraphs.length === 0) return <div className="sb-msg">{t("sidebar.empty")}</div>;
  const view = st.items.map((it, i) => {
    const meta = info.get(it.raw);
    return {
      ...it,
      name: meta?.label || it.raw || t("speaker.none"),
      color: meta?.color || (meta && !meta.mapeado ? (FALLBACK[i % 2] ?? GRIS) : GRIS),
    };
  });
  return (
    <div data-testid="stats">
      <div className="st-barra" role="img" aria-label={t("stats.barAria")}>
        {view.map((v) => (
          <div
            key={v.raw}
            style={{ width: pct(v.words, st.words) + "%", background: v.color }}
            title={t("stats.barTitle", { name: v.name, pct: pct(v.words, st.words) })}
          />
        ))}
      </div>
      {view.map((v) => (
        <div className="st-item" key={v.raw} data-habl={v.raw}>
          <div className="nom">
            <i style={{ background: v.color }}></i>
            {v.name}
          </div>
          <div>
            <b className="pal">{v.words}</b> {t("stats.wordsLabel")} ·{" "}
            <b>{pct(v.words, st.words)}%</b> {t("stats.ofText")}
          </div>
          <div>
            <b>{v.paragraphs}</b> {t("stats.paragraphs")} · {t("stats.time")}{" "}
            <b>{fmt(v.timeSec)}</b> · <b>{pct(v.timeSec, st.timeSec)}%</b>
          </div>
        </div>
      ))}
      <div className="st-tot">
        {t("stats.total")}: <b className="tot-pal">{st.words}</b> {t("stats.wordsLabel")} ·{" "}
        <b>{st.paragraphs}</b> {t("stats.paragraphs")} · <b>{fmt(st.timeSec)}</b>{" "}
        {t("stats.spokenEstimate")}
      </div>
    </div>
  );
}
