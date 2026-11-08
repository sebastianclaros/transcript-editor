import { describe, expect, it } from "vitest";
import {
  PALETA,
  GRIS,
  activeIndex,
  applyEdit,
  buildMinimap,
  buildSpeakerInfo,
  computeStats,
  countByEstado,
  countWords,
  cycleEstado,
  defaultProject,
  editParagraph,
  labelsInOrder,
  lineAt,
  markRead,
  markVerified,
  markerPct,
  minimapSummary,
  nextParagraphTarget,
  paragraphStartTarget,
  pct,
  segmentSeek,
  setEstado,
  speakerLabel,
  type Paragraph,
  type ProjectFile,
} from "../src";

const P = (
  id: number,
  speaker: string,
  text: string,
  seconds: number,
  estado: Paragraph["estado"] = "pendiente",
): Paragraph => ({
  id,
  speaker,
  text,
  seconds,
  estado,
});

const sample: Paragraph[] = [
  P(0, "A", "uno dos tres", 0),
  P(1, "B", "cuatro cinco", 10),
  P(2, "A", "seis", 25),
  P(3, "B", "— ... siete 8", 40),
];

describe("lineAt", () => {
  it("returns the last started paragraph", () => {
    expect(lineAt(sample, 0)).toBe(0);
    expect(lineAt(sample, 9.99)).toBe(0);
    expect(lineAt(sample, 10)).toBe(1);
    expect(lineAt(sample, 999)).toBe(3);
  });
  it("returns null before the first timed paragraph and for empty/untimed lists", () => {
    expect(lineAt([P(0, "A", "x", 5)], 1)).toBeNull();
    expect(lineAt([], 1)).toBeNull();
    expect(lineAt([P(0, "A", "x", -1)], 1)).toBeNull();
  });
  it("skips untimed paragraphs and stops at the first later one (non-monotonic)", () => {
    const ps = [P(0, "A", "a", 5), P(1, "A", "b", -1), P(2, "A", "c", 20), P(3, "A", "d", 10)];
    expect(lineAt(ps, 15)).toBe(0);
    expect(lineAt(ps, 25)).toBe(3); // 10 <= 25 is still scanned after 20
    // non monotonic: paragraph 3 (10) is never reached because 20 > 15 stops the scan
    expect(lineAt(ps, 12)).toBe(0);
  });
});

describe("estado transitions", () => {
  it("applyEdit sets corregido only on a real change", () => {
    const p = P(0, "A", "hola", 0, "verificado");
    expect(applyEdit(p, "hola")).toBe(p);
    expect(applyEdit(p, "  hola \n")).toBe(p);
    expect(applyEdit(p, "")).toBe(p);
    expect(applyEdit(p, "\n \u2028")).toBe(p);
    expect(applyEdit(p, "hola\nmundo")).toEqual({ ...p, text: "hola mundo", estado: "corregido" });
  });
  it("handles very long and unicode edits", () => {
    const p = P(0, "A", "x", 0);
    const long = "á".repeat(10000);
    expect(applyEdit(p, long).text).toHaveLength(10000);
    expect(applyEdit(p, "e\u0301 😀").text).toBe("e\u0301 😀");
  });
  it("editParagraph keeps length and returns the same array when unchanged", () => {
    const same = editParagraph(sample, 1, "cuatro cinco");
    expect(same.changed).toBe(false);
    expect(same.paragraphs).toBe(sample);
    const diff = editParagraph(sample, 1, "otra cosa");
    expect(diff.changed).toBe(true);
    expect(diff.paragraphs).toHaveLength(sample.length);
    expect(diff.paragraphs[1]).toMatchObject({ text: "otra cosa", estado: "corregido" });
    expect(sample[1]?.text).toBe("cuatro cinco");
    expect(editParagraph(sample, 99, "x").changed).toBe(false);
  });
  it("markRead only upgrades pendiente", () => {
    expect(markRead(sample, 0).paragraphs[0]?.estado).toBe("leido");
    for (const e of ["leido", "corregido", "verificado"] as const) {
      const ps = [P(0, "A", "x", 0, e)];
      expect(markRead(ps, 0).changed).toBe(false);
    }
  });
  it("cycles pendiente -> leido -> corregido -> verificado -> pendiente", () => {
    let ps: Paragraph[] = [P(0, "A", "x", 0)];
    const seen: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = cycleEstado(ps, 0);
      expect(r.changed).toBe(true);
      ps = r.paragraphs;
      seen.push(ps[0]?.estado ?? "");
    }
    expect(seen).toEqual(["leido", "corregido", "verificado", "pendiente", "leido"]);
  });
  it("markVerified and setEstado report changed correctly", () => {
    const r = markVerified(sample, 2);
    expect(r.changed).toBe(true);
    expect(markVerified(r.paragraphs, 2).changed).toBe(false);
    expect(setEstado(sample, 0, "pendiente").changed).toBe(false);
  });
  it("counts by estado", () => {
    const ps = [
      P(0, "A", "x", 0, "leido"),
      P(1, "A", "x", 0, "leido"),
      P(2, "A", "x", 0, "verificado"),
    ];
    expect(countByEstado(ps)).toEqual({ pendiente: 0, leido: 2, corregido: 0, verificado: 1 });
  });
});

describe("navigation", () => {
  it("activeIndex uses the id first, then time", () => {
    expect(activeIndex(sample, 2, 0)).toBe(2);
    expect(activeIndex(sample, null, 12)).toBe(1);
    expect(activeIndex(sample, 99, 12)).toBe(1);
    expect(activeIndex([], null, 3)).toBe(-1);
  });
  it("paragraphStartTarget returns start or previous within 1.2 s (scaled by rate)", () => {
    expect(paragraphStartTarget(sample, 1, 14, 1)).toEqual({ seconds: 10, kind: "start" });
    expect(paragraphStartTarget(sample, 1, 10.5, 1)).toEqual({ seconds: 0, kind: "previous" });
    // at 2x the threshold is 2.4 s
    expect(paragraphStartTarget(sample, 1, 12, 2)).toEqual({ seconds: 0, kind: "previous" });
    expect(paragraphStartTarget(sample, 1, 12, 1)).toEqual({ seconds: 10, kind: "start" });
    // first paragraph: nowhere to go back to, so go to its own start
    expect(paragraphStartTarget(sample, 0, 0.5, 1)).toEqual({ seconds: 0, kind: "start" });
    expect(paragraphStartTarget([], null, 0, 1)).toBeNull();
  });
  it("nextParagraphTarget skips untimed paragraphs", () => {
    const ps = [P(0, "A", "a", 0), P(1, "A", "b", -1), P(2, "A", "c", 30)];
    expect(nextParagraphTarget(ps, 0, 0)).toBe(30);
    expect(nextParagraphTarget(ps, 2, 31)).toBeNull();
  });
});

describe("speakers", () => {
  it("lists labels in first-appearance order including the empty one", () => {
    expect(
      labelsInOrder([P(0, "B", "x", 0), P(1, "", "x", 1), P(2, "A", "x", 2), P(3, "B", "x", 3)]),
    ).toEqual(["B", "", "A"]);
  });
  it("assigns palette colors cyclically and skips the empty label", () => {
    const labels = Array.from({ length: 9 }, (_, i) => `S${i}`);
    const pr = defaultProject(["", ...labels]);
    expect(pr.speakers).toHaveLength(9);
    expect(pr.speakers[0]?.color).toBe(PALETA[0]);
    expect(pr.speakers[8]?.color).toBe(PALETA[0]);
    expect(pr.visualizacion.colorearTexto).toBe(true);
  });
  it("speakerLabel follows the display preference", () => {
    const e = { id: "S0", nombre: "Ana Pérez", iniciales: "AP", color: null };
    expect(speakerLabel("S0", undefined, "nombre")).toBe("S0");
    expect(speakerLabel("S0", e, undefined)).toBe("Ana Pérez");
    expect(speakerLabel("S0", { ...e, nombre: "" }, undefined)).toBe("S0");
    expect(speakerLabel("S0", e, "iniciales")).toBe("AP");
    expect(speakerLabel("S0", { ...e, iniciales: "" }, "iniciales")).toBe("Ana Pérez");
    expect(speakerLabel("S0", e, "etiqueta")).toBe("S0");
    expect(speakerLabel("S0", { ...e, nombre: "", iniciales: "" }, "nombre")).toBe("S0");
  });
  it("buildSpeakerInfo marks mapped speakers and survives hostile labels", () => {
    const project: ProjectFile = {
      ...defaultProject(["A"]),
      speakers: [{ id: "A", nombre: "Ana", iniciales: "A.", color: "#112233" }],
    };
    const info = buildSpeakerInfo(
      [P(0, "A", "x", 0), P(1, "__proto__", "x", 1), P(2, "constructor", "y", 2)],
      project,
    );
    expect(info.get("A")).toEqual({ label: "Ana", color: "#112233", mapeado: true });
    expect(info.get("__proto__")).toEqual({ label: "__proto__", color: null, mapeado: false });
    expect(info.get("constructor")?.mapeado).toBe(false);
  });
});

describe("stats", () => {
  it("counts words by letter/digit tokens", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("  — ... ")).toBe(0);
    expect(countWords("uno, dos 3 ¿qué? 😀")).toBe(4);
    expect(countWords("123 4.5")).toBe(2);
    expect(countWords("niño áéí")).toBe(2);
  });
  it("computes per-speaker words and time (hand computed)", () => {
    // A: "uno dos tres"(3) + "seis"(1) = 4 words, 2 paragraphs, time 10 + 15 = 25
    // B: "cuatro cinco"(2) + "— ... siete 8"(2) = 4 words, 2 paragraphs, time 15 + (50-40)=10 -> 25
    const st = computeStats(sample, 50);
    expect(st.words).toBe(8);
    expect(st.paragraphs).toBe(4);
    expect(st.timeSec).toBe(50);
    expect(st.items).toEqual([
      { raw: "A", words: 4, paragraphs: 2, timeSec: 25 },
      { raw: "B", words: 4, paragraphs: 2, timeSec: 25 },
    ]);
    expect(pct(4, 8)).toBe(50);
  });
  it("last paragraph contributes 0 when the duration is unknown", () => {
    const st = computeStats(sample, 0);
    expect(st.timeSec).toBe(10 + 15 + 15 + 0);
  });
  it("handles empty, untimed and single speaker lists", () => {
    expect(computeStats([], 10)).toEqual({ items: [], words: 0, paragraphs: 0, timeSec: 0 });
    const untimed = computeStats([P(0, "A", "uno dos", -1), P(1, "A", "tres", -1)], 100);
    expect(untimed).toEqual({
      items: [{ raw: "A", words: 3, paragraphs: 2, timeSec: 0 }],
      words: 3,
      paragraphs: 2,
      timeSec: 0,
    });
  });
  it("clamps negative deltas for non monotonic times", () => {
    const st = computeStats([P(0, "A", "a", 20), P(1, "B", "b", 5)], 30);
    // A: next timed is 5 -> max(0, 5-20) = 0; B: 30-5 = 25
    expect(st.items.map((i) => i.timeSec)).toEqual([0, 25]);
  });
  it("pct rounds to one decimal and guards zero totals", () => {
    expect(pct(1, 3)).toBe(33.3);
    expect(pct(5, 0)).toBe(0);
  });
});

describe("minimap", () => {
  const info = new Map([["A", { label: "Ana", color: "#112233", mapeado: true }]]);
  it("is proportional when every paragraph is timed and duration is known", () => {
    const mm = buildMinimap(sample, 50, info);
    expect(mm.proportional).toBe(true);
    expect(mm.segments[0]).toMatchObject({
      id: 0,
      topPct: 0,
      heightPct: 20,
      color: "#112233",
      name: "Ana",
    });
    expect(mm.segments[3]).toMatchObject({ topPct: 80, heightPct: 20, color: GRIS, name: "B" });
  });
  it("falls back to equal slices", () => {
    const untimed = [P(0, "A", "a", 0), P(1, "", "b", -1)];
    const mm = buildMinimap(untimed, 50, info);
    expect(mm.proportional).toBe(false);
    expect(mm.segments.map((s) => [s.topPct, s.heightPct])).toEqual([
      [0, 50],
      [50, 50],
    ]);
    expect(mm.segments[1]?.name).toBe("");
    expect(buildMinimap(sample, 0, info).proportional).toBe(false);
    expect(buildMinimap([], 10, info)).toEqual({ proportional: false, segments: [] });
  });
  it("computes the marker", () => {
    expect(markerPct(true, 25, 50, 0, 4)).toBe(50);
    expect(markerPct(true, 99, 50, 0, 4)).toBe(100);
    expect(markerPct(true, 5, 0, 0, 4)).toBeNull();
    expect(markerPct(false, 0, 0, 1, 4)).toBe(37.5);
    expect(markerPct(false, 0, 0, -1, 4)).toBeNull();
  });
  it("maps a segment click to a seek time", () => {
    expect(segmentSeek(sample, 2)).toBe(25);
    expect(segmentSeek([P(0, "A", "x", -1)], 0)).toBeNull();
    expect(segmentSeek(sample, 99)).toBeNull();
  });
  it("summarizes progress", () => {
    const ps = [P(0, "A", "a", 0, "verificado"), P(1, "A", "b", 10), P(2, "A", "c", 20, "leido")];
    expect(minimapSummary(ps, 15, 60, 1)).toEqual({
      percent: 25,
      remainingSec: 45,
      paragraphNumber: 2,
      total: 3,
      counts: { pendiente: 1, leido: 1, corregido: 0, verificado: 1 },
      verified: 1,
    });
    expect(minimapSummary([], 0, 0, -1)).toMatchObject({
      percent: 0,
      paragraphNumber: null,
      remainingSec: 0,
    });
    expect(minimapSummary(ps, 70, 60, -1).remainingSec).toBe(0);
  });
});
