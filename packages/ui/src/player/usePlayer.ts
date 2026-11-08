import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";
import {
  clampTime,
  nextParagraphTarget,
  paragraphStartTarget,
  snapRate,
  stepRate,
  type MessageKey,
  type Paragraph,
  type Params,
} from "@transcript-editor/core";

type Say = (key: MessageKey, params?: Params) => void;

interface Options {
  mediaRef: RefObject<HTMLMediaElement | null>;
  paragraphsRef: MutableRefObject<Paragraph[]>;
  activeIdRef: MutableRefObject<number | null>;
  say: Say;
  initialRate: number;
  /** Called after the user (not the restore code) changes the speed. */
  onRateChanged?: (rate: number) => void;
}

/** Player actions. Everything reads state through refs, so callbacks are stable (no stale closures). */
export function usePlayer({
  mediaRef,
  paragraphsRef,
  activeIdRef,
  say,
  initialRate,
  onRateChanged,
}: Options) {
  const [rate, setRateState] = useState(() => snapRate(initialRate));
  const rateRef = useRef(rate);
  const sayRef = useRef(say);
  sayRef.current = say;
  const changedRef = useRef(onRateChanged);
  changedRef.current = onRateChanged;

  // The browser resets playbackRate when `src` changes, so reapply it on every load event.
  const applyRate = useCallback(() => {
    const el = mediaRef.current;
    if (!el) return;
    const r = rateRef.current;
    if (el.defaultPlaybackRate !== r) el.defaultPlaybackRate = r;
    if (el.playbackRate !== r) el.playbackRate = r;
    el.preservesPitch = true;
  }, [mediaRef]);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    const evs = ["loadstart", "loadedmetadata", "loadeddata", "canplay", "playing", "ratechange"];
    evs.forEach((e) => el.addEventListener(e, applyRate));
    applyRate();
    return () => evs.forEach((e) => el.removeEventListener(e, applyRate));
  }, [mediaRef, applyRate]);

  const setRate = useCallback(
    (v: number, opts: { announce?: boolean; persist?: boolean } = {}) => {
      const { announce = true, persist = true } = opts;
      const snapped = snapRate(v);
      rateRef.current = snapped;
      setRateState(snapped);
      applyRate();
      if (announce) sayRef.current("toast.speed", { rate: snapped });
      if (persist) changedRef.current?.(snapped);
    },
    [applyRate],
  );

  const stepSpeed = useCallback(
    (dir: 1 | -1) => setRate(stepRate(rateRef.current, dir)),
    [setRate],
  );

  const ready = useCallback(() => {
    const el = mediaRef.current;
    return !!(el && el.currentSrc && el.readyState >= 1);
  }, [mediaRef]);

  /** Seeks and STARTS playback (paragraph navigation, clicks on times and the minimap). */
  const seekTo = useCallback(
    (sec: number | null | undefined) => {
      const el = mediaRef.current;
      if (!el || sec == null || sec < 0) return;
      el.currentTime = clampTime(sec, Number.isFinite(el.duration) ? el.duration : 0);
      const p = el.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    },
    [mediaRef],
  );

  const togglePlay = useCallback(() => {
    const el = mediaRef.current;
    if (!el) return;
    if (!el.currentSrc) {
      sayRef.current("toast.noAudio");
      return;
    }
    if (el.paused) {
      const p = el.play();
      if (p && typeof p.catch === "function") p.catch(() => sayRef.current("toast.playFailed"));
      sayRef.current("toast.play");
    } else {
      el.pause();
      sayRef.current("toast.pause");
    }
  }, [mediaRef]);

  /** Moves the playhead without starting playback. */
  const nudge = useCallback(
    (delta: number) => {
      const el = mediaRef.current;
      if (!el) return;
      if (!ready()) {
        sayRef.current("toast.noAudio");
        return;
      }
      const max = Number.isFinite(el.duration) ? el.duration : Number.POSITIVE_INFINITY;
      el.currentTime = Math.max(0, Math.min(max, el.currentTime + delta));
      sayRef.current(delta < 0 ? "toast.back" : "toast.forward", { n: Math.abs(delta) });
    },
    [mediaRef, ready],
  );

  const audioStart = useCallback(() => {
    const el = mediaRef.current;
    if (!el) return;
    if (!ready()) {
      sayRef.current("toast.noAudio");
      return;
    }
    el.currentTime = 0;
    sayRef.current("toast.audioStart");
  }, [mediaRef, ready]);

  const paragraphStart = useCallback(() => {
    const el = mediaRef.current;
    if (!el) return;
    const target = paragraphStartTarget(
      paragraphsRef.current,
      activeIdRef.current,
      el.currentTime,
      el.playbackRate || 1,
    );
    if (!target) return;
    seekTo(target.seconds);
    sayRef.current(target.kind === "previous" ? "toast.paragraphPrevious" : "toast.paragraphStart");
  }, [mediaRef, paragraphsRef, activeIdRef, seekTo]);

  const nextParagraph = useCallback(() => {
    const el = mediaRef.current;
    const target = nextParagraphTarget(
      paragraphsRef.current,
      activeIdRef.current,
      el ? el.currentTime : 0,
    );
    if (target == null) return;
    seekTo(target);
    sayRef.current("toast.paragraphNext");
  }, [mediaRef, paragraphsRef, activeIdRef, seekTo]);

  return {
    rate,
    setRate,
    stepSpeed,
    seekTo,
    togglePlay,
    nudge,
    audioStart,
    paragraphStart,
    nextParagraph,
  };
}

export type Player = ReturnType<typeof usePlayer>;
