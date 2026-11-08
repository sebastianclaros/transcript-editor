#!/usr/bin/env node
// Package boundary check (design 1.1 / 1.3). Second enforcement layer next to ESLint.
// Usage: node scripts/check-boundaries.mjs [repoRoot]
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/** Allowed runtime dependencies per package (workspace-internal names included). */
export const ALLOWED_DEPS = {
  "packages/core": ["zod"],
  "packages/storage": ["@transcript-editor/core", "zod"],
  "packages/ui": ["@transcript-editor/core", "@transcript-editor/storage", "react", "react-dom"],
};

/** Forbidden import specifiers in src/** per package (exact or prefix match). */
const NODE_BUILTINS = [
  "node:",
  "fs",
  "path",
  "os",
  "child_process",
  "crypto",
  "url",
  "http",
  "https",
];
export const FORBIDDEN_IMPORTS = {
  "packages/core": [
    "react",
    "electron",
    "@transcript-editor/ui",
    "@transcript-editor/storage",
    "@transcript-editor/desktop",
    ...NODE_BUILTINS,
  ],
  "packages/storage": [
    "react",
    "electron",
    "@transcript-editor/ui",
    "@transcript-editor/desktop",
    ...NODE_BUILTINS,
  ],
  "packages/ui": ["electron", "@transcript-editor/desktop", ...NODE_BUILTINS],
  "apps/desktop/src/renderer": ["electron", ...NODE_BUILTINS],
};

const IMPORT_RE =
  /(?:import\s+(?:[^'"]*?\sfrom\s+)?|export\s+[^'"]*?\sfrom\s+|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g;

function isForbidden(spec, list) {
  return list.some((f) =>
    f.endsWith(":") ? spec.startsWith(f) : spec === f || spec.startsWith(`${f}/`),
  );
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "out" || name === "dist") continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(name)) out.push(p);
  }
  return out;
}

/** @returns {string[]} human readable violations */
export function checkBoundaries(root) {
  const problems = [];
  for (const [pkg, allowed] of Object.entries(ALLOWED_DEPS)) {
    const pj = join(root, pkg, "package.json");
    if (!existsSync(pj)) continue;
    const json = JSON.parse(readFileSync(pj, "utf8"));
    for (const dep of Object.keys(json.dependencies ?? {})) {
      if (!allowed.includes(dep)) {
        problems.push(
          `${pkg}/package.json: dependency "${dep}" is not allowed (allowed: ${allowed.join(", ")})`,
        );
      }
    }
  }
  for (const [pkg, forbidden] of Object.entries(FORBIDDEN_IMPORTS)) {
    const srcDir = join(root, pkg.startsWith("apps/") ? pkg : join(pkg, "src"));
    for (const file of walk(srcDir)) {
      if (/\.test\.[a-z]+$/.test(file)) continue;
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(IMPORT_RE)) {
        const spec = m[1];
        if (isForbidden(spec, forbidden)) {
          problems.push(
            `${relative(root, file).split(sep).join("/")}: import of "${spec}" is forbidden in ${pkg} (see docs/architecture.md)`,
          );
        }
      }
    }
  }
  return problems;
}

const here = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === here) {
  const root = resolve(process.argv[2] ?? join(here, "..", ".."));
  const problems = checkBoundaries(root);
  if (problems.length > 0) {
    console.error("Package boundary violations:\n" + problems.map((p) => `  - ${p}`).join("\n"));
    process.exit(1);
  }
  console.log("check-boundaries: ok");
}
