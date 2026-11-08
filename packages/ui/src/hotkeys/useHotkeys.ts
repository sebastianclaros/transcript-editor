import { useEffect, useRef } from "react";
import { matchHotkey, type ActionId } from "@transcript-editor/core";

export type HotkeyActions = Record<ActionId, () => void>;

/**
 * One capture-phase keydown listener on `window`, registered once. Actions are read from a ref
 * reassigned on every render, so the listener never sees stale closures.
 */
export function useHotkeys(actions: HotkeyActions) {
  const ref = useRef(actions);
  ref.current = actions;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const hit = matchHotkey(e);
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat && !hit.repeatable) return;
      ref.current[hit.action]();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
}
