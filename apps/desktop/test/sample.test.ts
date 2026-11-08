import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseClean, parseProjectFile, readMeta, validateFileName } from "@transcript-editor/core";

const dir = join(__dirname, "..", "..", "..", "samples", "demo-session");
const read = (n: string) => readFileSync(join(dir, n), "utf8");

describe("samples/demo-session", () => {
  const parsed = parseProjectFile(JSON.parse(read("proyecto.json")));
  it("has a valid project file whose files exist", () => {
    if ("error" in parsed) throw new Error("invalid project");
    expect(parsed.warnings).toEqual([]);
    const { archivos, speakers } = parsed.project;
    for (const n of [archivos.audio, archivos.texto, archivos.meta]) {
      expect(validateFileName(n).ok).toBe(true);
      expect(() => readFileSync(join(dir, n as string))).not.toThrow();
    }
    expect(speakers.map((s) => s.id)).toEqual(["SPEAKER_00", "SPEAKER_01"]);
  });
  it("parses cleanly with matching meta and increasing times", () => {
    const rm = readMeta(read("demo.meta.json"));
    const r = parseClean(read("demo.txt"), rm.meta, rm.warnings);
    expect(r.warnings).toEqual([]);
    expect(r.paragraphs).toHaveLength(10);
    const times = r.paragraphs.map((p) => p.seconds);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
  it("keeps the last paragraph inside the audio duration (ffprobe) and the file small", () => {
    const size = readFileSync(join(dir, "demo.m4a")).length;
    expect(size).toBeLessThan(300 * 1024);
    let duration: number | null = null;
    try {
      duration = Number(
        execFileSync(
          "ffprobe",
          [
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=nw=1:nk=1",
            join(dir, "demo.m4a"),
          ],
          {
            encoding: "utf8",
          },
        ),
      );
    } catch {
      // ffprobe is optional in CI; the generated file is 75 s (see scripts/make-sample.sh)
    }
    const rm = readMeta(read("demo.meta.json"));
    const last = parseClean(read("demo.txt"), rm.meta).paragraphs.at(-1)!.seconds;
    expect(last).toBeLessThanOrEqual(duration ?? 75);
    if (duration !== null) expect(Math.abs(duration - 75)).toBeLessThan(1);
  });
});
