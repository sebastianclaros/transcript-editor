#!/usr/bin/env node
// Verifies the Kiro project files: steering front matter, 16 spec folders with three files each,
// EARS phrasing in requirements, and AGENTS.md.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SPECS = [
  "transcript-playback",
  "hotkeys-and-player",
  "paragraph-editing-and-estados",
  "speakers-and-project-file",
  "minimap-and-stats",
  "local-storage-and-memory",
  "project-open-flow",
  "packaging-and-releases",
  "google-drive-connection",
  "drive-local-first-sync",
  "byo-and-build-time-client-id",
  "merge-multiple-audios",
  "cloud-web-edition",
  "signing-and-auto-update",
  "plugin-or-export-api",
  "speaker-diarization-in-app",
];
const STEERING = {
  "product.md": "always",
  "tech.md": "always",
  "structure.md": "always",
  "conventions.md": "always",
  "security.md": "fileMatch",
  "release.md": "fileMatch",
  "roadmap-process.md": "manual",
};
const IMPLEMENTED = SPECS.slice(0, 8);

export function checkKiro(root) {
  const problems = [];
  if (!existsSync(join(root, "AGENTS.md"))) problems.push("AGENTS.md is missing");
  for (const [file, mode] of Object.entries(STEERING)) {
    const p = join(root, ".kiro", "steering", file);
    if (!existsSync(p)) {
      problems.push(`steering/${file} is missing`);
      continue;
    }
    const text = readFileSync(p, "utf8");
    const m = /^---\ninclusion: (\w+)\n([\s\S]*?)---\n/.exec(text);
    if (!m) problems.push(`steering/${file} has no front matter`);
    else {
      if (m[1] !== mode) problems.push(`steering/${file} should be inclusion: ${mode}`);
      if (mode === "fileMatch" && !/fileMatchPattern:/.test(m[2]))
        problems.push(`steering/${file} needs fileMatchPattern`);
    }
    if (mode === "always" && text.split("\n").length >= 120)
      problems.push(`steering/${file} is 120+ lines`);
  }
  const dir = join(root, ".kiro", "specs");
  const found = existsSync(dir) ? readdirSync(dir) : [];
  for (const s of SPECS) {
    if (!found.includes(s)) {
      problems.push(`spec ${s} is missing`);
      continue;
    }
    for (const f of ["requirements.md", "design.md", "tasks.md"]) {
      if (!existsSync(join(dir, s, f))) problems.push(`spec ${s}/${f} is missing`);
    }
    const req = join(dir, s, "requirements.md");
    if (existsSync(req) && !/THE SYSTEM SHALL/.test(readFileSync(req, "utf8")))
      problems.push(`spec ${s} requirements are not EARS`);
    const tasks = join(dir, s, "tasks.md");
    if (
      existsSync(tasks) &&
      !IMPLEMENTED.includes(s) &&
      /- \[x\]/.test(readFileSync(tasks, "utf8"))
    ) {
      problems.push(`future spec ${s} has checked tasks`);
    }
  }
  return problems;
}

const here = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === here) {
  const root = resolve(process.argv[2] ?? join(here, "..", ".."));
  const problems = checkKiro(root);
  if (problems.length) {
    console.error("Kiro files:\n" + problems.map((p) => `  - ${p}`).join("\n"));
    process.exit(1);
  }
  console.log("check-kiro: ok");
}
