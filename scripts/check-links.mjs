#!/usr/bin/env node
// Checks that every relative link in the README files and docs/ resolves to an existing file.
// Usage: node scripts/check-links.mjs [repoRoot]
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "out" || name === "dist") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

export function findBrokenLinks(root, files) {
  const broken = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
    for (const m of text.matchAll(LINK)) {
      const target = m[1];
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      const path = target.split("#")[0];
      if (!path) continue;
      // links like ../../releases are GitHub UI routes, not files
      if (/^(\.\.\/)+(releases|issues|discussions|actions)/.test(path)) continue;
      const abs = resolve(dirname(file), path);
      if (!existsSync(abs)) broken.push(`${relative(root, file)} -> ${target}`);
    }
  }
  return broken;
}

const here = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === here) {
  const root = resolve(process.argv[2] ?? join(here, "..", ".."));
  const files = [
    ...[
      "README.md",
      "README.es.md",
      "CONTRIBUTING.md",
      "SECURITY.md",
      "ROADMAP.md",
      "CHANGELOG.md",
      "AGENTS.md",
    ]
      .map((f) => join(root, f))
      .filter(existsSync),
    ...walk(join(root, "docs")),
    ...walk(join(root, "tools")),
  ];
  const broken = findBrokenLinks(root, files);
  if (broken.length) {
    console.error("Broken relative links:\n" + broken.map((b) => `  - ${b}`).join("\n"));
    process.exit(1);
  }
  console.log(`check-links: ok (${files.length} files)`);
}
