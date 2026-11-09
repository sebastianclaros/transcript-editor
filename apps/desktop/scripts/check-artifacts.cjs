#!/usr/bin/env node
// Verifies that `dist/` contains files named like the documented patterns (README download table).
const fs = require("node:fs");
const path = require("node:path");
const version = require("../../../package.json").version;
const brand = require("../../../brand.json");
const n = brand.executableName;
const dist = path.join(__dirname, "..", "dist");
const patterns = [
  [/^.+-linux-x86_64\.AppImage$/, `${n}-${version}-linux-x86_64.AppImage`],
  [/^.+-linux-amd64\.deb$/, `${n}-${version}-linux-amd64.deb`],
  [/^.+-mac-(x64|arm64)\.(dmg|zip)$/, `${n}-${version}-mac-<arch>.<dmg|zip>`],
  [/^.+-win-setup-x64\.exe$/, `${n}-${version}-win-setup-x64.exe`],
  [/^.+-win-x64\.zip$/, `${n}-${version}-win-x64.zip`],
];
const files = fs.existsSync(dist) ? fs.readdirSync(dist) : [];
const produced = files.filter((f) => /\.(AppImage|deb|dmg|zip|exe)$/.test(f));
let bad = 0;
for (const f of produced) {
  const hit = patterns.find(([re]) => re.test(f));
  if (!hit || !f.startsWith(`${n}-${version}-`)) {
    console.error(`unexpected artifact name: ${f}`);
    bad++;
  } else console.log(`ok: ${f}`);
}
if (fs.existsSync(path.join(dist, "linux-unpacked"))) console.log("ok: linux-unpacked/");
if (produced.length === 0 && !fs.existsSync(path.join(dist, "linux-unpacked"))) {
  console.error("no artifacts found in dist/");
  process.exit(1);
}
process.exit(bad ? 1 : 0);
