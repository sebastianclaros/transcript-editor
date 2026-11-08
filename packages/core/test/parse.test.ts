import { describe, expect, it } from "vitest";
import {
  detectFormat,
  InvariantError,
  parseClean,
  parseRaw,
  planEditedNames,
  readMeta,
  serializeClean,
  serializeMeta,
  type Paragraph,
} from "../src";

describe("readMeta", () => {
  it("handles missing, invalid and valid", () => {
    expect(readMeta(null).warnings).toEqual([{ code: "meta_missing" }]);
    expect(readMeta("{oops").warnings).toEqual([{ code: "meta_invalid_json" }]);
    expect(readMeta("\ufeff[]").meta).toEqual([]);
    expect(readMeta("[]").warnings).toEqual([]);
  });
});

describe("parseClean", () => {
  const meta = [
    { seconds: 0, speaker: "SPEAKER_00", estado: "leido" },
    { seconds: 12.5, speaker: "SPEAKER_01", estado: "verificado" },
  ];
  it("combines text and meta by index", () => {
    const r = parseClean("SPEAKER_00: Hola, ¿qué tal?\nSPEAKER_01: Bien, gracias.\n", meta);
    expect(r.format).toBe("clean");
    expect(r.warnings).toEqual([]);
    expect(r.paragraphs).toEqual([
      { id: 0, speaker: "SPEAKER_00", text: "Hola, ¿qué tal?", seconds: 0, estado: "leido" },
      { id: 1, speaker: "SPEAKER_01", text: "Bien, gracias.", seconds: 12.5, estado: "verificado" },
    ]);
  });
  it("handles BOM, CRLF and trailing blank lines", () => {
    const r = parseClean("\ufeffA: uno\r\nB: dos\r\n\r\n", meta);
    expect(r.paragraphs.map((p) => p.text)).toEqual(["uno", "dos"]);
  });
  it("returns no paragraphs for empty text and no timing warning", () => {
    const r = parseClean("", []);
    expect(r.paragraphs).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
  it("warns when meta is shorter or longer", () => {
    const short = parseClean("A: 1\nB: 2\nC: 3\n", meta);
    expect(short.warnings).toContainEqual({
      code: "meta_length_mismatch",
      textLines: 3,
      metaItems: 2,
    });
    expect(short.paragraphs[2]).toMatchObject({ seconds: -1, estado: "pendiente", speaker: "C" });
    const long = parseClean("A: 1\n", meta);
    expect(long.warnings).toContainEqual({
      code: "meta_length_mismatch",
      textLines: 1,
      metaItems: 2,
    });
    expect(long.paragraphs).toHaveLength(1);
  });
  it("treats missing meta with a warning and no_times", () => {
    const r = parseClean("A: hola\n", undefined);
    expect(r.warnings.map((w) => w.code)).toEqual(["meta_missing", "no_times"]);
    expect(r.paragraphs[0]?.seconds).toBe(-1);
  });
  it("treats non-array meta as invalid", () => {
    const r = parseClean("A: hola\n", { not: "array" });
    expect(r.warnings.map((w) => w.code)).toContain("meta_invalid_json");
  });
  it("uses preWarnings from readMeta without duplicating", () => {
    const rm = readMeta("{oops");
    const r = parseClean("A: hola\n", rm.meta, rm.warnings);
    expect(r.warnings.filter((w) => w.code === "meta_invalid_json")).toHaveLength(1);
    expect(r.warnings.filter((w) => w.code === "meta_missing")).toHaveLength(0);
  });
  it("normalizes bad meta values", () => {
    const r = parseClean("A: x\nB: y\nC: z\nD: w\n", [
      { seconds: -5, estado: "nope" },
      { seconds: "7", speaker: 42 },
      null,
      { seconds: Infinity },
    ]);
    for (const p of r.paragraphs) {
      expect(p.seconds).toBe(-1);
      expect(p.estado).toBe("pendiente");
    }
    expect(r.paragraphs.map((p) => p.speaker)).toEqual(["A", "B", "C", "D"]);
  });
  it("prefers the meta speaker and falls back to the label", () => {
    const r = parseClean("Etiqueta: texto\nOtra: texto\n", [
      { speaker: "Meta", seconds: 1 },
      { speaker: "" },
    ]);
    expect(r.paragraphs.map((p) => p.speaker)).toEqual(["Meta", "Otra"]);
  });
  it("supports the ? speaker and unicode", () => {
    const r = parseClean("?: ¿Eh? 😀 niño\n", [{ seconds: 3, speaker: "?" }]);
    expect(r.paragraphs[0]).toMatchObject({ speaker: "?", text: "¿Eh? 😀 niño" });
  });
  it("keeps lines without label and whitespace-only lines", () => {
    const r = parseClean("sin etiqueta\n   \nA: x\n", []);
    expect(r.paragraphs.map((p) => [p.speaker, p.text])).toEqual([
      ["", "sin etiqueta"],
      ["", "   "],
      ["A", "x"],
    ]);
  });
  it("sanitizes meta speakers and warns", () => {
    const r = parseClean("a: uno\nb: dos\n", [
      { speaker: "Ana: Pérez", seconds: 0 },
      { speaker: "B", seconds: 1 },
    ]);
    expect(r.paragraphs[0]?.speaker).toBe("Ana\u2236 Pérez");
    expect(r.warnings).toContainEqual({ code: "speaker_sanitized", count: 1 });
  });
  it("reports non monotonic and missing times", () => {
    const r = parseClean("A: 1\nB: 2\nC: 3\n", [{ seconds: 10 }, { seconds: 5 }, { seconds: 20 }]);
    expect(r.warnings).toContainEqual({ code: "non_monotonic_times", firstIndex: 1 });
    const none = parseClean("A: 1\n", [{ seconds: -1 }]);
    expect(none.warnings).toContainEqual({ code: "no_times" });
  });
});

describe("parseRaw", () => {
  const raw = [
    "[00:00:05] SPEAKER_00: Buenos días.",
    "",
    "[00:01:10] SPEAKER_01: Hola, ¿cómo estás?",
    "",
    "[01:02:03] ?: no se entiende",
    "",
  ].join("\n");

  it("derives paragraphs and seconds", () => {
    const r = parseRaw(raw);
    expect(r.format).toBe("raw");
    expect(r.paragraphs).toEqual([
      { id: 0, speaker: "SPEAKER_00", text: "Buenos días.", seconds: 5, estado: "pendiente" },
      {
        id: 1,
        speaker: "SPEAKER_01",
        text: "Hola, ¿cómo estás?",
        seconds: 70,
        estado: "pendiente",
      },
      { id: 2, speaker: "?", text: "no se entiende", seconds: 3723, estado: "pendiente" },
    ]);
    expect(r.warnings).toEqual([]);
  });
  it("accepts hours with more than two digits and CRLF + BOM", () => {
    const r = parseRaw("\ufeff[100:00:00] A: x\r\n");
    expect(r.paragraphs[0]?.seconds).toBe(360000);
  });
  it("keeps unstamped lines as paragraphs with unknown time", () => {
    const r = parseRaw("[00:00:01] A: uno\ncontinuación sin sello\n");
    expect(r.paragraphs).toHaveLength(2);
    expect(r.paragraphs[1]).toMatchObject({
      seconds: -1,
      text: "continuación sin sello",
      speaker: "",
    });
    expect(r.warnings).toContainEqual({ code: "raw_unstamped_lines", count: 1 });
  });
  it("does not match stamps with minutes or seconds above 59", () => {
    const r = parseRaw("[00:75:00] A: x\n");
    expect(r.paragraphs[0]?.seconds).toBe(-1);
    // the line stays unstamped; the label regex then splits at the first colon (same as unir.sh)
    expect(r.paragraphs[0]).toMatchObject({ speaker: "[00", text: "75:00] A: x" });
    expect(r.warnings).toContainEqual({ code: "raw_unstamped_lines", count: 1 });
  });
  it("drops stamp-only lines and keeps indices aligned", () => {
    const r = parseRaw("[00:00:01] A: uno\n[00:01:00]\n[00:01:30]   \t\n[00:02:00] B: dos\n");
    expect(r.paragraphs.map((p) => p.id)).toEqual([0, 1]);
    expect(r.paragraphs[1]?.seconds).toBe(120);
    expect(r.warnings).toContainEqual({ code: "raw_empty_stamped_lines", count: 2 });
  });
  it("applies the degenerate-label rule after the stamp", () => {
    const r = parseRaw("[00:00:01]   :\n");
    expect(r.paragraphs[0]).toMatchObject({ speaker: "", text: ":" });
  });
  it("returns empty for empty input", () => {
    expect(parseRaw("").paragraphs).toEqual([]);
    expect(parseRaw("\n\n  \n").paragraphs).toEqual([]);
  });
});

describe("detectFormat", () => {
  it("detects raw and clean", () => {
    expect(detectFormat("[00:00:01] A: x\n\n[00:00:02] B: y\n")).toBe("raw");
    expect(detectFormat("A: x\nB: y\n")).toBe("clean");
    expect(detectFormat("")).toBe("clean");
    expect(detectFormat("[00:00:01] A: x\nA: y\nB: z\nC: w\n")).toBe("clean");
    expect(detectFormat("[00:00:01] A: x\nB: y\n")).toBe("raw");
  });
});

describe("serializeClean", () => {
  const ps: Paragraph[] = [
    { id: 0, speaker: "A", text: "uno", seconds: 0, estado: "leido" },
    { id: 1, speaker: "", text: "sin etiqueta", seconds: 5, estado: "pendiente" },
  ];
  it("writes text and meta", () => {
    const { text, meta } = serializeClean(ps);
    expect(text).toBe("A: uno\nsin etiqueta\n");
    expect(meta).toEqual([
      { seconds: 0, speaker: "A", estado: "leido" },
      { seconds: 5, speaker: "", estado: "pendiente" },
    ]);
    expect(serializeMeta(meta).endsWith("]\n")).toBe(true);
  });
  it("returns empty text for no paragraphs", () => {
    expect(serializeClean([]).text).toBe("");
  });
  it("never writes an empty line (placeholder or strict error)", () => {
    const bad: Paragraph[] = [{ id: 0, speaker: "", text: "", seconds: -1, estado: "pendiente" }];
    expect(serializeClean(bad).text).toBe(" \n");
    expect(() => serializeClean(bad, { strict: true })).toThrow(InvariantError);
  });
  it("round trips a degenerate-label file in strict mode without changes", () => {
    const first = parseClean("  :\nhola\n", []);
    const { text } = serializeClean(first.paragraphs, { strict: true });
    expect(text).toBe("  :\nhola\n");
    expect(parseClean(text, []).paragraphs).toHaveLength(2);
  });
  it("serializes a speaker with empty text as non-empty", () => {
    const p: Paragraph[] = [{ id: 0, speaker: "X", text: "", seconds: 1, estado: "pendiente" }];
    const { text } = serializeClean(p, { strict: true });
    expect(text).toBe("X: \n");
    expect(parseClean(text, [{ seconds: 1 }]).paragraphs[0]).toMatchObject({
      speaker: "X",
      text: "",
    });
  });
});

describe("planEditedNames", () => {
  it("uses .editado.txt and .meta.json first", () => {
    expect(planEditedNames("sesion.txt", new Set())).toEqual({
      texto: "sesion.editado.txt",
      meta: "sesion.meta.json",
    });
  });
  it("increments when either exists", () => {
    expect(planEditedNames("s.txt", new Set(["s.editado.txt"]))).toEqual({
      texto: "s.editado-2.txt",
      meta: "s.editado-2.meta.json",
    });
    expect(planEditedNames("s.txt", new Set(["s.meta.json", "s.editado-2.meta.json"]))).toEqual({
      texto: "s.editado-3.txt",
      meta: "s.editado-3.meta.json",
    });
  });
  it("keeps names within 255 chars", () => {
    const r = planEditedNames("x".repeat(300) + ".txt", new Set());
    expect(r.texto.length).toBeLessThanOrEqual(255);
    expect(r.meta.length).toBeLessThanOrEqual(255);
  });
  it("falls back for names that become invalid", () => {
    const r = planEditedNames("CON.txt", new Set());
    expect(r.texto).toBe("transcript.editado.txt");
    expect(planEditedNames("CON.txt", new Set(["transcript.editado.txt"])).texto).toBe(
      "transcript.editado-2.txt",
    );
  });
});
