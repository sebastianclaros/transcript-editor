import { describe, expect, it } from "vitest";
import {
  DICTIONARIES,
  HOTKEYS,
  VELOCIDADES,
  createPluralTranslator,
  createTranslator,
  formatHotkey,
  interpolate,
  isLanguage,
  languageFromLocale,
  matchHotkey,
  rateIndex,
  snapRate,
  stepRate,
  type KeyEventLike,
} from "../src";

const ev = (over: Partial<KeyEventLike>): KeyEventLike => ({
  ctrlKey: true,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  code: "",
  key: "",
  repeat: false,
  ...over,
});

describe("matchHotkey", () => {
  it.each([
    [{ code: "KeyS", key: "s" }, "save"],
    [{ code: "Space", key: " " }, "togglePlay"],
    [{ code: "Space", key: " ", shiftKey: true }, "togglePlay"],
    [{ code: "ArrowLeft" }, "back5"],
    [{ code: "ArrowRight", shiftKey: true }, "fwd5"],
    [{ code: "ArrowUp" }, "paragraphStart"],
    [{ code: "ArrowDown" }, "nextParagraph"],
    [{ code: "Home" }, "audioStart"],
    [{ code: "Enter" }, "markVerified"],
    [{ code: "NumpadEnter", shiftKey: true }, "markVerified"],
    [{ code: "Comma", shiftKey: true }, "speedDown"],
    [{ code: "Period", shiftKey: true }, "speedUp"],
  ] as const)("%j -> %s", (e, action) => {
    expect(matchHotkey(ev(e))?.action).toBe(action);
    expect(matchHotkey(ev({ ...e, ctrlKey: false, metaKey: true }))?.action).toBe(action);
  });
  it("matches Cmd+S on a non-QWERTY layout by key", () => {
    expect(matchHotkey(ev({ code: "Semicolon", key: "s" }))?.action).toBe("save");
  });
  it("ignores Shift+S, plain keys, AltGr and unrelated combos", () => {
    expect(matchHotkey(ev({ code: "KeyS", key: "S", shiftKey: true }))).toBeNull();
    expect(matchHotkey(ev({ ctrlKey: false, code: "Space", key: " " }))).toBeNull();
    expect(matchHotkey(ev({ code: "ArrowLeft", altKey: true }))).toBeNull();
    expect(matchHotkey(ev({ code: "KeyC", key: "c" }))).toBeNull();
    expect(matchHotkey(ev({ code: "KeyZ", key: "z" }))).toBeNull();
    expect(matchHotkey(ev({ code: "Comma" }))).toBeNull(); // speed needs Shift
    expect(matchHotkey(ev({ code: "Period" }))).toBeNull();
  });
  it("flags only the nudges as repeatable", () => {
    const repeatable = HOTKEYS.filter((h) => h.repeatable).map((h) => h.action);
    expect(repeatable).toEqual(["back5", "fwd5"]);
    expect(matchHotkey(ev({ code: "ArrowLeft", repeat: true }))?.repeatable).toBe(true);
    expect(matchHotkey(ev({ code: "Space", key: " ", repeat: true }))?.repeatable).toBe(false);
  });
  it("every table action is reachable", () => {
    expect(new Set(HOTKEYS.map((h) => h.action)).size).toBe(HOTKEYS.length);
  });
  it("formats Mod by platform", () => {
    expect(formatHotkey("Mod+S", "darwin")).toBe("Cmd+S");
    expect(formatHotkey("Mod+S", "linux")).toBe("Ctrl+S");
  });
});

describe("rate", () => {
  it("snaps to the nearest step with ties to the lower one", () => {
    expect(snapRate(1)).toBe(1);
    expect(snapRate(0.3)).toBe(0.75);
    expect(snapRate(1.25)).toBe(1); // tie between 1 and 1.5
    expect(snapRate(1.3)).toBe(1.5);
    expect(snapRate(4)).toBe(2);
    expect(snapRate(NaN)).toBe(1);
  });
  it("steps within bounds and treats unknown as x1", () => {
    expect(stepRate(1, 1)).toBe(1.5);
    expect(stepRate(2, 1)).toBe(2);
    expect(stepRate(0.75, -1)).toBe(0.75);
    expect(stepRate(1.2, 1)).toBe(1.5);
    expect(rateIndex(1.2)).toBe(1);
    expect(VELOCIDADES).toEqual([0.75, 1, 1.5, 2]);
  });
});

describe("i18n", () => {
  const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  it("has identical keys and placeholders in es and en", () => {
    const es = DICTIONARIES.es;
    const en = DICTIONARIES.en;
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
    for (const k of Object.keys(es) as (keyof typeof es)[]) {
      expect(es[k].length, k).toBeGreaterThan(0);
      expect(en[k].length, k).toBeGreaterThan(0);
      expect(placeholders(en[k]), k).toEqual(placeholders(es[k]));
    }
  });
  it("interpolates and leaves missing params visible", () => {
    expect(interpolate("a {n} b", { n: 3 })).toBe("a 3 b");
    expect(interpolate("a {n} b", {})).toBe("a {n} b");
    expect(interpolate("plain")).toBe("plain");
    expect(createTranslator("es")("toast.back", { n: 5 })).toBe("Retroceder 5 s");
    expect(createTranslator("en")("toast.back", { n: 5 })).toBe("Back 5 s");
  });
  it("selects plurals with paired keys", () => {
    const tn = createPluralTranslator("en");
    // no *_one / *_other keys exist yet: the translator falls back to the key itself
    expect(tn("missing", 1)).toBe("missing_one");
  });
  it("detects languages", () => {
    expect(isLanguage("es")).toBe(true);
    expect(isLanguage("fr")).toBe(false);
    expect(languageFromLocale("en-US")).toBe("en");
    expect(languageFromLocale("es-AR")).toBe("es");
    expect(languageFromLocale("fr")).toBe("es");
    expect(languageFromLocale(undefined)).toBe("es");
  });
});
