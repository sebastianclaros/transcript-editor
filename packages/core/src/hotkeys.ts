export type ActionId =
  | "save"
  | "togglePlay"
  | "back5"
  | "fwd5"
  | "paragraphStart"
  | "nextParagraph"
  | "audioStart"
  | "markVerified"
  | "speedDown"
  | "speedUp";

export interface KeyEventLike {
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  code: string;
  key: string;
  repeat?: boolean;
}

export interface HotkeyDef {
  action: ActionId;
  /** Display text with `Mod` standing for Ctrl or Cmd; null when there is none. */
  primary: string | null;
  alternative: string | null;
  repeatable: boolean;
}

/** Single source of truth for the Help modal and docs/hotkeys.md. */
export const HOTKEYS: readonly HotkeyDef[] = [
  { action: "save", primary: "Mod+S", alternative: null, repeatable: false },
  { action: "togglePlay", primary: "Mod+Space", alternative: "Mod+Shift+Space", repeatable: false },
  { action: "back5", primary: "Mod+←", alternative: "Mod+Shift+←", repeatable: true },
  { action: "fwd5", primary: "Mod+→", alternative: "Mod+Shift+→", repeatable: true },
  { action: "paragraphStart", primary: "Mod+↑", alternative: "Mod+Shift+↑", repeatable: false },
  { action: "nextParagraph", primary: "Mod+↓", alternative: "Mod+Shift+↓", repeatable: false },
  { action: "audioStart", primary: "Mod+Home", alternative: "Mod+Shift+Home", repeatable: false },
  {
    action: "markVerified",
    primary: "Mod+Enter",
    alternative: "Mod+Shift+Enter",
    repeatable: false,
  },
  { action: "speedDown", primary: null, alternative: "Mod+Shift+,", repeatable: false },
  { action: "speedUp", primary: null, alternative: "Mod+Shift+.", repeatable: false },
];

const NAV: Record<string, ActionId> = {
  ArrowLeft: "back5",
  ArrowRight: "fwd5",
  ArrowUp: "paragraphStart",
  ArrowDown: "nextParagraph",
  Home: "audioStart",
};

/**
 * Pure matcher by physical key code. Either Ctrl or Cmd counts as Mod on every platform; AltGr
 * (Ctrl+Alt) is ignored because it types characters.
 */
export function matchHotkey(e: KeyEventLike): { action: ActionId; repeatable: boolean } | null {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return null;
  const key = e.key ?? "";
  let action: ActionId | null = null;
  if (e.code === "KeyS" || key.toLowerCase() === "s") {
    if (!e.shiftKey) action = "save";
  } else if (e.code === "Space" || key === " ") action = "togglePlay";
  else if (e.code in NAV) action = NAV[e.code] ?? null;
  else if (e.code === "Enter" || e.code === "NumpadEnter" || key === "Enter")
    action = "markVerified";
  else if (e.shiftKey && e.code === "Comma") action = "speedDown";
  else if (e.shiftKey && e.code === "Period") action = "speedUp";
  if (!action) return null;
  const def = HOTKEYS.find((h) => h.action === action);
  return { action, repeatable: def?.repeatable ?? false };
}

/** Replaces `Mod` with the platform name. */
export function formatHotkey(
  combo: string,
  platform: "darwin" | "win32" | "linux" | "web",
): string {
  return combo.replace(/^Mod/, platform === "darwin" ? "Cmd" : "Ctrl");
}
