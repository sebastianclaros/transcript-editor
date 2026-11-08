import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { scanContent, scanFileName, SKIP_FILES, runScan, globToRegExp } from "./privacy-scan.mjs";

const j = (...p) => p.join("");
const here = dirname(fileURLToPath(import.meta.url));

describe("privacy scan patterns", () => {
  it("detects positives assembled at runtime", () => {
    const samples = {
      "github-token": j("gh", "p_", "a".repeat(30)),
      "github-pat": j("github", "_pat_", "A1".repeat(15)),
      "google-api-key": j("AI", "za", "x".repeat(35)),
      "hf-token": j("h", "f_", "A".repeat(25)),
      "author-home-path": j("/ho", "me/", "flow/x"),
      "users-path": j("/Us", "ers/", "maria/docs"),
      "real-name-a": j("hola ", "So", "fi", "!"),
      "real-name-b": j("de ", "Ale", "xis"),
      "oauth-client-id-value": j(
        "123456789012-abcdefgh1234",
        ".apps.",
        "google",
        "usercontent",
        ".com",
      ),
      "oauth-secret-value": j('"client', '_secret": "abcdefgh12"'),
      "windows-users-path": j("C:", "\\", "Us", "ers", "\\x"),
    };
    for (const [id, text] of Object.entries(samples)) {
      const ids = scanContent("docs/x.md", text, []).map((f) => f.id);
      expect(ids, id).toContain(id);
    }
  });

  it("does not trip on Spanish words or placeholder paths", () => {
    expect(scanContent("docs/x.md", "una solucion sofisticado", [])).toEqual([]);
    expect(
      scanContent("docs/x.md", j("/Us", "ers/<you>/Downloads and ", "/Us", "ers/you/x"), []),
    ).toEqual([]);
  });

  it("honours the allow-list per pattern and never for secret values", () => {
    const allow = [
      { file: "docs/**", pattern: "oauth-secret-word", re: globToRegExp("docs/**"), used: false },
    ];
    const word = j("the client", "_secret is none");
    expect(scanContent("docs/a.md", word, allow)).toEqual([]);
    expect(scanContent("src/a.ts", word, allow)).toHaveLength(1);
    const value = j("client", "_secret=abcdefgh12");
    expect(scanContent("docs/a.md", value, allow).map((f) => f.id)).toContain("oauth-secret-value");
  });

  it("flags env files, media and big files by name", () => {
    expect(scanFileName(".env", 1, []).map((f) => f.id)).toEqual(["env-file"]);
    expect(scanFileName(".env.example", 1, [])).toEqual([]);
    expect(scanFileName("a/b.mp3", 1, []).map((f) => f.id)).toEqual(["media-file"]);
    expect(scanFileName("samples/demo-session/demo.m4a", 1, [])).toEqual([]);
    expect(scanFileName("x.bin", 2 * 1024 * 1024, []).map((f) => f.id)).toEqual(["big-file"]);
  });

  it("skips exactly the two documented files", () => {
    expect(SKIP_FILES).toEqual(["scripts/privacy-patterns.mjs", "scripts/privacy-allow.json"]);
  });

  it("finds nothing in its own sources", () => {
    for (const f of [
      "privacy-scan.mjs",
      "privacy-scan.test.mjs",
      "privacy-patterns.mjs",
      "privacy-allow.json",
      "check-boundaries.mjs",
    ]) {
      const text = readFileSync(join(here, f), "utf8");
      expect(scanContent(`scripts/${f}`, text, []), f).toEqual([]);
    }
  });

  it("works on a repo with no commits and on untracked files", () => {
    const dir = mkdtempSync(join(tmpdir(), "te-priv-"));
    try {
      execFileSync("git", ["-C", dir, "init", "-q", "-b", "main"]);
      writeFileSync(join(dir, "a.txt"), j("token ", "gh", "p_", "z".repeat(30)));
      const { findings } = runScan(dir);
      expect(findings.map((f) => f.id)).toEqual(["github-token"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
