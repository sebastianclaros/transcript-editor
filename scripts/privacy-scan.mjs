#!/usr/bin/env node
// Privacy / secret scan over the working tree and the whole git history (design 11.2).
// Usage: node scripts/privacy-scan.mjs [repoRoot] [--no-history]
// Prints rule ids and file:line only, never the matched value.
import { execFileSync } from "node:child_process";
import { readFileSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONTENT_PATTERNS,
  NEVER_ALLOWED,
  MEDIA_EXT,
  ALLOWED_MEDIA,
  MAX_FILE_BYTES,
  ENV_FILE,
  ENV_EXAMPLE,
} from "./privacy-patterns.mjs";

/** Exactly two paths are skipped by name: the files that must describe the patterns. */
export const SKIP_FILES = ["scripts/privacy-patterns.mjs", "scripts/privacy-allow.json"];

export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*" && glob[i + 1] === "*") {
      re += ".*";
      i++;
      if (glob[i + 1] === "/") i++;
    } else if (c === "*") re += "[^/]*";
    else re += c.replace(/[.+^${}()|[\]\\?]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

export function loadAllowList(root) {
  const p = join(root, "scripts", "privacy-allow.json");
  if (!existsSync(p)) return [];
  const raw = JSON.parse(readFileSync(p, "utf8"));
  return raw.map((e) => ({ ...e, re: globToRegExp(e.file), used: false }));
}

function isAllowed(allow, file, id) {
  if (NEVER_ALLOWED.has(id)) return false;
  let ok = false;
  for (const e of allow) {
    if (e.pattern === id && e.re.test(file)) {
      e.used = true;
      ok = true;
    }
  }
  return ok;
}

export function scanContent(file, content, allow) {
  const findings = [];
  if (SKIP_FILES.includes(file)) return findings;
  const lines = content.split(/\r?\n/);
  lines.forEach((line, idx) => {
    for (const { id, re } of CONTENT_PATTERNS) {
      if (re.test(line) && !isAllowed(allow, file, id)) {
        findings.push({ file, line: idx + 1, id });
      }
    }
  });
  return findings;
}

export function scanFileName(file, size, allow) {
  const findings = [];
  if (ENV_FILE.test(file) && !ENV_EXAMPLE.test(file))
    findings.push({ file, line: 0, id: "env-file" });
  if (MEDIA_EXT.test(file) && !ALLOWED_MEDIA.has(file))
    findings.push({ file, line: 0, id: "media-file" });
  if (size > MAX_FILE_BYTES && !isAllowed(allow, file, "big-file"))
    findings.push({ file, line: 0, id: "big-file" });
  return findings;
}

const git = (root, args) =>
  execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });

function hasCommits(root) {
  try {
    git(root, ["rev-parse", "--verify", "HEAD"]);
    return true;
  } catch {
    return false;
  }
}

function looksBinary(buf) {
  return buf.subarray(0, 8000).includes(0);
}

export function scanTree(root, allow) {
  const files = git(root, ["ls-files", "-co", "--exclude-standard", "-z"])
    .split("\0")
    .filter(Boolean);
  const findings = [];
  for (const f of files) {
    const abs = join(root, f);
    if (!existsSync(abs)) continue;
    const st = statSync(abs);
    if (!st.isFile()) continue;
    findings.push(...scanFileName(f, st.size, allow));
    const buf = readFileSync(abs);
    if (looksBinary(buf)) continue;
    findings.push(...scanContent(f, buf.toString("utf8"), allow));
  }
  return findings;
}

export function scanHistory(root, allow) {
  if (!hasCommits(root)) return [];
  const findings = [];
  const names = git(root, ["log", "--all", "--name-only", "--pretty=format:", "-z"])
    .split("\0")
    .filter(Boolean);
  for (const n of new Set(names)) {
    const f = scanFileName(n.trim(), 0, allow);
    // A media/env file name is a finding only if it still violates today's rules.
    findings.push(...f.map((x) => ({ ...x, file: `history:${x.file}` })));
  }
  const patch = git(root, ["log", "--all", "-p", "--no-color", "--pretty=format:", "--text"]);
  let current = "";
  patch.split("\n").forEach((line, idx) => {
    if (line.startsWith("+++ b/")) {
      current = line.slice(6);
      return;
    }
    if (!line.startsWith("+") || line.startsWith("+++")) return;
    for (const hit of scanContent(current, line.slice(1), allow)) {
      findings.push({ file: `history:${current}`, line: idx + 1, id: hit.id });
    }
  });
  return findings;
}

export function runScan(root, { history = true } = {}) {
  const allow = loadAllowList(root);
  const findings = [...scanTree(root, allow)];
  if (history) findings.push(...scanHistory(root, allow));
  const stale = allow.filter((e) => !e.used).map((e) => `${e.file} (${e.pattern})`);
  return { findings, stale };
}

const here = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === here) {
  const args = process.argv.slice(2);
  const root = resolve(args.find((a) => !a.startsWith("--")) ?? join(here, "..", ".."));
  const { findings, stale } = runScan(root, { history: !args.includes("--no-history") });
  for (const f of findings) console.error(`privacy-scan: ${f.id} at ${f.file}:${f.line}`);
  for (const s of stale) console.error(`privacy-scan: stale allow-list entry ${s}`);
  if (findings.length > 0 || stale.length > 0) process.exit(1);
  console.log("privacy-scan: ok");
}
