import { useEffect, useState, type RefObject } from "react";

/** Duration only (no timeupdate): used by widgets that do not depend on the playhead. */
export function useDuration(mediaRef: RefObject<HTMLMediaElement | null>): number {
  const [dur, setDur] = useState(0);
  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    const sync = () => setDur(Number.isFinite(el.duration) ? el.duration : 0);
    const evs = ["loadedmetadata", "durationchange", "emptied"];
    evs.forEach((e) => el.addEventListener(e, sync));
    sync();
    return () => evs.forEach((e) => el.removeEventListener(e, sync));
  }, [mediaRef]);
  return dur;
}
