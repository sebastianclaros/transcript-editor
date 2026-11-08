import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  cycleEstado,
  editParagraph,
  markRead,
  markVerified,
  parseClean,
  parseRaw,
  serializeClean,
  setEstado,
  ESTADOS,
  type Paragraph,
} from "../src";

// Hostile line fragments (design 6.4 item 5). All invented.
const nasty = fc.constantFrom(
  "[00:01:00]",
  "[00:01:00]   ",
  "[00:01:00]\t",
  "X:",
  "?:",
  ":",
  "  :",
  " : ",
  "\t:",
  "[00:02:00]   :",
  "[00:03:00] \t : ",
  "x".repeat(40) + ": t",
  "x".repeat(41) + ": t",
  "   ",
  "hola: mundo",
  "[00:75:00] A: no",
  "😀: emoji",
);
const word = fc.stringMatching(/^[A-Za-zñáé0-9 ,.:?¿!]{0,25}$/);
const stamp = fc
  .tuple(
    fc.integer({ min: 0, max: 120 }),
    fc.integer({ min: 0, max: 59 }),
    fc.integer({ min: 0, max: 59 }),
  )
  .map(
    ([h, m, s]) =>
      `[${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}]`,
  );
const rawLine = fc.oneof(
  nasty,
  fc.tuple(stamp, fc.constantFrom(" ", "  ", "\t", ""), word).map(([s, sp, w]) => s + sp + w),
  fc.tuple(stamp, word, word).map(([s, a, b]) => `${s} ${a}: ${b}`),
  word,
);
const rawText = fc
  .tuple(fc.array(rawLine, { maxLength: 15 }), fc.constantFrom("\n", "\r\n"), fc.boolean())
  .map(([lines, nl, bom]) => (bom ? "\ufeff" : "") + lines.join(nl));

const cleanLine = fc.oneof(
  nasty,
  word,
  fc.tuple(word, word).map(([a, b]) => `${a}: ${b}`),
);
const cleanText = fc
  .array(cleanLine, { maxLength: 15 })
  .map((ls) => ls.filter((l) => l.length > 0).join("\n"));
const hostileSpeaker = fc.oneof(
  fc.constant(""),
  fc.constant("a:b"),
  fc.constant("x".repeat(60)),
  fc.constant("line\nbreak"),
  word,
);
const metaItem = fc.record(
  {
    seconds: fc.oneof(
      fc.integer({ min: -3, max: 500 }),
      fc.double({ noNaN: true, min: 0, max: 500 }),
      fc.constant("x"),
    ),
    speaker: hostileSpeaker,
    estado: fc.oneof(fc.constantFrom(...ESTADOS), fc.constant("bogus")),
  },
  { requiredKeys: [] },
);

type Op =
  | { t: "edit"; i: number; text: string }
  | { t: "set"; i: number; e: (typeof ESTADOS)[number] }
  | { t: "cycle"; i: number }
  | { t: "read"; i: number }
  | { t: "ver"; i: number };
const op = fc.oneof(
  fc.record({
    t: fc.constant("edit" as const),
    i: fc.nat(30),
    text: fc.oneof(word, fc.constantFrom("a\nb", "x\u2028y", "\n", "", "  :", ":")),
  }),
  fc.record({ t: fc.constant("set" as const), i: fc.nat(30), e: fc.constantFrom(...ESTADOS) }),
  fc.record({ t: fc.constant("cycle" as const), i: fc.nat(30) }),
  fc.record({ t: fc.constant("read" as const), i: fc.nat(30) }),
  fc.record({ t: fc.constant("ver" as const), i: fc.nat(30) }),
);

function apply(ps: Paragraph[], o: Op): Paragraph[] {
  const id = ps.length === 0 ? 0 : o.i % ps.length;
  switch (o.t) {
    case "edit":
      return editParagraph(ps, id, o.text).paragraphs;
    case "set":
      return setEstado(ps, id, o.e).paragraphs;
    case "cycle":
      return cycleEstado(ps, id).paragraphs;
    case "read":
      return markRead(ps, id).paragraphs;
    case "ver":
      return markVerified(ps, id).paragraphs;
  }
}

function checkRoundTrip(start: Paragraph[], ops: Op[]) {
  let ps = start;
  for (const o of ops) {
    const before = ps.length;
    ps = apply(ps, o);
    expect(ps).toHaveLength(before);
    ps.forEach((p, i) => expect(p.id).toBe(i));
  }
  const { text, meta } = serializeClean(ps, { strict: true });
  const nonEmpty = text.split("\n").filter((l) => l.length > 0);
  expect(nonEmpty).toHaveLength(ps.length);
  const back = parseClean(text, meta);
  expect(back.paragraphs).toHaveLength(ps.length);
  back.paragraphs.forEach((p, i) => {
    expect(p.id).toBe(ps[i]?.id);
    expect(p.estado).toBe(ps[i]?.estado);
    expect(p.seconds).toBe(ps[i]?.seconds);
  });
}

describe("paragraph-count invariant (property tests)", () => {
  it("holds from the raw entry path", () => {
    fc.assert(
      fc.property(rawText, fc.array(op, { maxLength: 12 }), (text, ops) => {
        checkRoundTrip(parseRaw(text).paragraphs, ops);
      }),
      { numRuns: 400 },
    );
  });
  it("holds from the clean entry path with hostile meta", () => {
    fc.assert(
      fc.property(
        cleanText,
        fc.array(metaItem, { maxLength: 18 }),
        fc.array(op, { maxLength: 12 }),
        (text, meta, ops) => {
          const parsed = parseClean(text, meta);
          checkRoundTrip(parsed.paragraphs, ops);
        },
      ),
      { numRuns: 400 },
    );
  });
  it("keeps speaker and text unchanged after sanitizing on a round trip", () => {
    fc.assert(
      fc.property(cleanText, fc.array(metaItem, { maxLength: 18 }), (text, meta) => {
        const a = parseClean(text, meta);
        const { text: t2, meta: m2 } = serializeClean(a.paragraphs, { strict: true });
        const b = parseClean(t2, m2);
        a.paragraphs.forEach((p, i) => {
          // a paragraph with a speaker keeps both fields; an unlabeled one may gain a label (documented quirk)
          if (p.speaker !== "") {
            expect(b.paragraphs[i]?.speaker).toBe(p.speaker);
            // leading whitespace after "Label: " is eaten by the label regex (documented quirk)
            expect(b.paragraphs[i]?.text).toBe(p.text.trimStart());
          }
        });
        expect(b.warnings.some((w) => w.code === "speaker_sanitized")).toBe(false);
      }),
      { numRuns: 300 },
    );
  });

  it("example: stamp-only lines keep indices aligned with meta", () => {
    const parsed = parseRaw("[00:00:01] A: uno\n[00:00:30]\n[00:01:00] B: dos\n");
    const { text, meta } = serializeClean(parsed.paragraphs, { strict: true });
    const back = parseClean(text, meta);
    expect(back.paragraphs.map((p) => p.seconds)).toEqual([1, 60]);
  });
  it("example: empty edit, newline edit, line separator edit, giant edit", () => {
    const ps = parseRaw("[00:00:01] A: uno\n").paragraphs;
    expect(editParagraph(ps, 0, "").changed).toBe(false);
    expect(editParagraph(ps, 0, "a\nb").paragraphs[0]?.text).toBe("a b");
    expect(editParagraph(ps, 0, "a\u2028b").paragraphs[0]?.text).toBe("a b");
    expect(editParagraph(ps, 0, "z".repeat(10000)).paragraphs[0]?.text).toHaveLength(10000);
  });
});
