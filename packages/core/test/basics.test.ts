import { describe, expect, it } from "vitest";
import {
  BRAND,
  clampTime,
  fileKindOf,
  fmt,
  isValidFileName,
  normalizeText,
  parseClock,
  sanitizeSpeaker,
  splitLabel,
  validateFileName,
} from "../src";

describe("brand", () => {
  it("exposes the product name from brand.json", () => {
    expect(BRAND.productName).toBe("Transcript Editor");
    expect(BRAND.protocols.media).toBe("app-media");
  });
});

describe("time", () => {
  it("formats seconds", () => {
    expect(fmt(0)).toBe("00:00");
    expect(fmt(65.9)).toBe("01:05");
    expect(fmt(3661)).toBe("01:01:01");
    expect(fmt(-1)).toBe("--:--");
    expect(fmt(NaN)).toBe("--:--");
    expect(fmt(null)).toBe("--:--");
    expect(fmt(Infinity)).toBe("--:--");
  });
  it("parses clock strings", () => {
    expect(parseClock("01:05")).toBe(65);
    expect(parseClock("1:01:01")).toBe(3661);
    expect(parseClock("1:75")).toBeNull();
    expect(parseClock("abc")).toBeNull();
  });
  it("clamps", () => {
    expect(clampTime(-3, 10)).toBe(0);
    expect(clampTime(30, 10)).toBe(10);
    expect(clampTime(30, NaN)).toBe(30);
    expect(clampTime(5, 10)).toBe(5);
  });
});

describe("fileKindOf", () => {
  it.each([
    ["a.MP4", "audio"],
    ["a.m4a", "audio"],
    ["a.mp3", "audio"],
    ["a.wav", "audio"],
    ["a.ogg", "audio"],
    ["a.txt", "text"],
    ["a.JSON", "json"],
    ["a.pdf", "other"],
    ["noext", "other"],
  ])("%s -> %s", (name, kind) => {
    expect(fileKindOf(name)).toBe(kind);
  });
});

describe("validateFileName", () => {
  it("accepts ordinary names", () => {
    expect(validateFileName("unido.mp4").ok).toBe(true);
    expect(validateFileName("sesión 1.txt").ok).toBe(true);
    expect(isValidFileName("a.meta.json")).toBe(true);
  });
  it.each([
    [42, "not_string"],
    ["", "length"],
    ["a".repeat(256), "length"],
    ["a\u0000b", "control_char"],
    ["a\nb", "control_char"],
    ["../x", "separator"],
    ["a/b", "separator"],
    ["a\\b", "separator"],
    ["a:b", "separator"],
    ["a*b", "separator"],
    [".", "dot_name"],
    ["..", "dot_name"],
    [".env", "dotfile"],
    ["name.", "trailing"],
    ["name ", "trailing"],
    ["CON", "reserved"],
    ["nul.txt", "reserved"],
    ["Com1.json", "reserved"],
  ])("rejects %j (%s)", (name, reason) => {
    const r = validateFileName(name);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe(reason);
    expect(isValidFileName(name)).toBe(false);
  });
});

describe("text helpers", () => {
  it("normalizes line breaks", () => {
    expect(normalizeText("  a\r\nb\u2028c\u2029\n d ")).toBe("a b c  d");
    expect(normalizeText("\n\n")).toBe("");
  });
  it("splits labels like the prototype", () => {
    expect(splitLabel("Ana: hola: mundo")).toEqual({ label: "Ana", body: "hola: mundo" });
    expect(splitLabel("sin etiqueta")).toEqual({ label: "", body: "sin etiqueta" });
    expect(splitLabel("A:")).toEqual({ label: "A", body: "" });
    expect(splitLabel("?: dudoso")).toEqual({ label: "?", body: "dudoso" });
    // label longer than 40 chars is not a label
    const long = "x".repeat(41) + ": texto";
    expect(splitLabel(long)).toEqual({ label: "", body: long });
    const ok40 = "x".repeat(40) + ": texto";
    expect(splitLabel(ok40).label).toBe("x".repeat(40));
  });
  it("applies the degenerate-label rule", () => {
    for (const line of ["  :", " : ", "\t:", ":"]) {
      expect(splitLabel(line)).toEqual({ label: "", body: line });
    }
    // blank label with a real body is split, label trimmed to empty
    expect(splitLabel(" : hola")).toEqual({ label: "", body: "hola" });
  });
  it("sanitizes speakers", () => {
    expect(sanitizeSpeaker("  Ana\nPérez ")).toBe("Ana Pérez");
    expect(sanitizeSpeaker("A: B")).toBe("A\u2236 B");
    expect(sanitizeSpeaker("x".repeat(60))).toBe("x".repeat(40));
    expect(sanitizeSpeaker("   ")).toBe("");
  });
  it("does not cut a surrogate pair when truncating", () => {
    const s = "x".repeat(39) + "😀" + "tail";
    const out = sanitizeSpeaker(s);
    expect(out).toBe("x".repeat(39));
    expect(out.length).toBeLessThanOrEqual(40);
    const s2 = "x".repeat(38) + "😀" + "tail";
    expect(sanitizeSpeaker(s2)).toBe("x".repeat(38) + "😀");
  });
});
