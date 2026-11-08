import type { RefObject } from "react";
import { fmt, VELOCIDADES, formatHotkey } from "@transcript-editor/core";
import type { HostApi } from "@transcript-editor/storage";
import { IcBack, IcFwd, IcNext, IcPause, IcPlay, IcPrev } from "../components/Icons";
import { useT } from "../i18n/I18n";
import { useMediaClock } from "./useMediaClock";

interface Props {
  mediaRef: RefObject<HTMLMediaElement | null>;
  platform: HostApi["platform"];
  onToggle: () => void;
  onNudge: (delta: number) => void;
  onPrev: () => void;
  onNext: () => void;
  rate: number;
  onRate: (v: number) => void;
}

/** Player controls in the fixed top bar: rewind / play-pause / forward, speed, seek slider. */
export function Transport({
  mediaRef,
  platform,
  onToggle,
  onNudge,
  onPrev,
  onNext,
  rate,
  onRate,
}: Props) {
  const t = useT();
  const { t: now, setT, dur, playing, dragging } = useMediaClock(mediaRef);
  const hint = (combo: string) => formatHotkey(combo, platform);
  const move = (v: number) => {
    const el = mediaRef.current;
    setT(v);
    if (el) el.currentTime = v;
  };
  return (
    <div className="transport" role="group" aria-label={t("player.label")}>
      <button
        className="icon-btn"
        onClick={onPrev}
        aria-label={t("player.prev")}
        title={`${t("player.prevTitle")} (${hint("Mod+↑")})`}
      >
        <IcPrev />
      </button>
      <button
        className="icon-btn"
        onClick={() => onNudge(-5)}
        aria-label={t("player.back5")}
        title={`${t("player.back5Title")} (${hint("Mod+←")})`}
      >
        <IcBack />
        <span className="sec">5</span>
      </button>
      <button
        className="icon-btn big"
        onClick={onToggle}
        aria-label={playing ? t("player.pause") : t("player.play")}
        title={`${playing ? t("player.pause") : t("player.play")} (${hint("Mod+Space")})`}
      >
        {playing ? <IcPause /> : <IcPlay />}
      </button>
      <button
        className="icon-btn"
        onClick={() => onNudge(5)}
        aria-label={t("player.fwd5")}
        title={`${t("player.fwd5Title")} (${hint("Mod+→")})`}
      >
        <IcFwd />
        <span className="sec">5</span>
      </button>
      <button
        className="icon-btn"
        onClick={onNext}
        aria-label={t("player.next")}
        title={`${t("player.next")} (${hint("Mod+↓")})`}
      >
        <IcNext />
      </button>
      <div className="velocidad" role="group" aria-label={t("player.speed")}>
        {VELOCIDADES.map((v) => (
          <button
            key={v}
            className={v === rate ? "sel" : ""}
            aria-pressed={v === rate}
            aria-label={t("player.speedTimes", { rate: v })}
            title={t("player.speedTitle", {
              rate: v,
              down: hint("Mod+Shift+,"),
              up: hint("Mod+Shift+."),
            })}
            onClick={() => onRate(v)}
          >
            {`x${v}`}
          </button>
        ))}
      </div>
      <span className="tiempos" aria-hidden="true">
        <b>{fmt(now)}</b> / {fmt(dur)}
      </span>
      <input
        type="range"
        min="0"
        max={dur || 0}
        step="0.1"
        value={Math.min(now, dur || 0)}
        disabled={!dur}
        aria-label={t("player.position")}
        aria-valuetext={t("player.positionText", { now: fmt(now), total: fmt(dur) })}
        title={t("player.position")}
        onPointerDown={() => {
          dragging.current = true;
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onBlur={() => {
          dragging.current = false;
        }}
        onChange={(e) => move(Number(e.target.value))}
      />
      <span className="tiempos" title={t("player.remaining")}>
        -{fmt(Math.max(0, dur - now))}
      </span>
    </div>
  );
}
