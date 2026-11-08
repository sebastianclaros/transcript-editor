import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import { lineAt, type Paragraph } from "@transcript-editor/core";

interface Options {
  mediaRef: RefObject<HTMLMediaElement | null>;
  paragraphsRef: MutableRefObject<Paragraph[]>;
  activeIdRef: MutableRefObject<number | null>;
  setActiveId: (id: number | null) => void;
  /** Playback entered a paragraph (active id changed while playing). */
  onEnter: (id: number) => void;
}

/**
 * ONE requestAnimationFrame loop registered once. Acts only while the audio is playing; reads
 * everything through refs. A `seeked` listener highlights the paragraph while paused WITHOUT
 * changing any estado.
 */
export function useActiveSync({
  mediaRef,
  paragraphsRef,
  activeIdRef,
  setActiveId,
  onEnter,
}: Options) {
  const onEnterRef = useLatest(onEnter);
  const setActiveRef = useLatest(setActiveId);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = mediaRef.current;
      if (el && !el.paused) {
        const current = lineAt(paragraphsRef.current, el.currentTime);
        if (current !== activeIdRef.current) {
          activeIdRef.current = current;
          setActiveRef.current(current);
          if (current != null) onEnterRef.current(current);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const el0 = mediaRef.current;
    const onSeeked = () => {
      if (!el0 || !el0.paused) return;
      const current = lineAt(paragraphsRef.current, el0.currentTime);
      if (current !== activeIdRef.current) {
        activeIdRef.current = current;
        setActiveRef.current(current);
      }
    };
    el0?.addEventListener("seeked", onSeeked);
    return () => {
      cancelAnimationFrame(raf);
      el0?.removeEventListener("seeked", onSeeked);
    };
    // Registered once on purpose: everything is read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function useLatest<T>(value: T): { current: T } {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
