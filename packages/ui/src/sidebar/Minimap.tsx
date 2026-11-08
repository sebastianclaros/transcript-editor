import { memo, useMemo, type MouseEvent, type RefObject } from "react";
import {
  ESTADOS,
  GRIS,
  buildMinimap,
  fmt,
  markerPct,
  minimapSummary,
  type MinimapSegment,
  type Paragraph,
  type SpeakerInfo,
} from "@transcript-editor/core";
import { useT } from "../i18n/I18n";
import { useMediaClock } from "../player/useMediaClock";

type Lane = "estado" | "hablante";

const Segments = memo(function Segments({
  segs,
  activeId,
  lane,
}: {
  segs: MinimapSegment[];
  activeId: number | null;
  lane: Lane;
}) {
  const t = useT();
  return (
    <>
      {segs.map((s) => (
        <div
          key={s.id}
          data-id={s.id}
          className={"mapa-seg" + (s.id === activeId ? " activo" : "")}
          title={
            lane === "estado"
              ? t("mapa.segEstado", { n: s.id + 1, estado: t(`estado.${s.estado}`) })
              : t("mapa.segHablante", { n: s.id + 1, name: s.name || t("speaker.none") })
          }
          style={{
            top: s.topPct + "%",
            height: s.heightPct + "%",
            background: lane === "estado" ? `var(--est-${s.estado})` : s.color,
          }}
        />
      ))}
    </>
  );
});

interface Props {
  paragraphs: Paragraph[];
  activeId: number | null;
  mediaRef: RefObject<HTMLMediaElement | null>;
  info: SpeakerInfo;
  onGo: (id: number) => void;
}

/** Two-lane progress map (estado + speaker). Only the playhead re-renders on timeupdate. */
export function Minimap({ paragraphs, activeId, mediaRef, info, onGo }: Props) {
  const t = useT();
  const { t: now, dur } = useMediaClock(mediaRef);
  const mm = useMemo(() => buildMinimap(paragraphs, dur, info), [paragraphs, dur, info]);
  const n = paragraphs.length;
  const activeIndex = activeId == null ? -1 : paragraphs.findIndex((p) => p.id === activeId);
  const marker = markerPct(mm.proportional, now, dur, activeIndex, n);
  const sum = minimapSummary(paragraphs, now, dur, activeIndex);
  const click = (e: MouseEvent<HTMLDivElement>) => {
    const id = (e.target as HTMLElement).dataset?.id;
    if (id != null) onGo(Number(id));
  };
  if (n === 0) return <div className="sb-msg">{t("sidebar.empty")}</div>;
  const legend = [...info.entries()];
  const lanes: Array<[Lane, string, string]> = [
    ["estado", t("mapa.laneEstado"), t("mapa.ariaEstado")],
    ["hablante", t("mapa.laneHablante"), t("mapa.ariaHablante")],
  ];
  return (
    <>
      <div className="mapa">
        <div className="mapa-lanes">
          {lanes.map(([lane, title, aria]) => (
            <div key={lane}>
              <div className="lane-tit">{title}</div>
              {/* Click-to-seek is a pointer shortcut; keyboard users navigate with the hotkeys. */}
              {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
              <div
                className="mapa-col"
                onClick={click}
                role="img"
                aria-label={aria}
                title={t("mapa.clickHint")}
              >
                <Segments segs={mm.segments} activeId={activeId} lane={lane} />
                {marker != null && (
                  <div className="mapa-marca" style={{ top: `calc(${marker}% - 1px)` }} />
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mapa-info" aria-live="off">
          <div className="big">{sum.percent}%</div>
          <div>
            {t("mapa.remaining")} <b>{fmt(sum.remainingSec)}</b>
          </div>
          <div>{t("mapa.paragraphOf", { n: sum.paragraphNumber ?? "–", total: sum.total })}</div>
          <div style={{ marginTop: 6 }}>
            {ESTADOS.map((s) => (
              <div key={s}>
                <span className="dot" style={{ background: `var(--est-${s})` }}></span>
                {t(`estado.${s}`)}: <b>{sum.counts[s]}</b>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 6 }}>
            {t("mapa.verified", { n: sum.verified, total: sum.total })}
          </div>
        </div>
      </div>
      {legend.length > 0 && (
        <div className="leyenda" aria-label={t("mapa.speakers")}>
          {legend.map(([raw, h]) => (
            <span className="chip" key={raw} title={raw}>
              <i style={{ background: h.color || GRIS }}></i>
              <span>{h.label || t("speaker.none")}</span>
            </span>
          ))}
        </div>
      )}
    </>
  );
}
