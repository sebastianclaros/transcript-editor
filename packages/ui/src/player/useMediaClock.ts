import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Time, duration and play state of a media element. Owns its own listeners so that playback ticks
 * re-render only the component that uses it (the transport), never the paragraph list.
 * `timeupdate` (about 4 Hz) feeds the label and slider; it is NOT used to highlight paragraphs.
 */
export function useMediaClock(mediaRef: RefObject<HTMLMediaElement | null>) {
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const dragging = useRef(false);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    const sync = () => {
      if (!dragging.current) setT(el.currentTime || 0);
      setDur(Number.isFinite(el.duration) ? el.duration : 0);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const evs = ["timeupdate", "loadedmetadata", "durationchange", "seeked", "emptied"];
    evs.forEach((e) => el.addEventListener(e, sync));
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onPause);
    sync();
    setPlaying(!el.paused);
    return () => {
      evs.forEach((e) => el.removeEventListener(e, sync));
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onPause);
    };
  }, [mediaRef]);

  return { t, setT, dur, playing, dragging };
}
