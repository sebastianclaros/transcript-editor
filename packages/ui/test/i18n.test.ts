import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DICTIONARIES } from "@transcript-editor/core";

const SRC = join(__dirname, "..", "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

// Spanish letters/punctuation or common Spanish words inside string literals or JSX text.
const SPANISH =
  /[áéíóúñ¿¡]|\b(Guardar|Abrir|Cerrar|Cancelar|Ayuda|Proyecto|archivo|párrafo|hablante)\b/i;

describe("i18n hygiene", () => {
  it("has no hard-coded Spanish literals in ui sources (everything goes through the dictionaries)", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const text = readFileSync(file, "utf8")
        // strip comments
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
      const literals = [...text.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`|>([^<>{}\n]+)</g)];
      for (const m of literals) {
        const s = m[1] ?? m[2] ?? m[3] ?? m[4] ?? "";
        // identifiers, file names and the language endonym are not UI prose
        if (/^[\w.${}-]+$/.test(s) || s === "Español") continue;
        if (SPANISH.test(s)) offenders.push(`${file}: ${s}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("every key used with t() exists in both dictionaries", () => {
    const keys = new Set<string>();
    for (const file of walk(SRC)) {
      for (const m of readFileSync(file, "utf8").matchAll(/\bt\(\s*"([a-zA-Z0-9_.]+)"/g))
        keys.add(m[1]!);
    }
    for (const k of keys) {
      expect(DICTIONARIES.es, k).toHaveProperty(k);
      expect(DICTIONARIES.en, k).toHaveProperty(k);
    }
    expect(keys.size).toBeGreaterThan(50);
  });
});
