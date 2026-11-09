#!/usr/bin/env node
// Runs the Playwright Electron suite against the unpackaged build.
// Needs a display. Locally that is your desktop session; in CI use `xvfb-run -a npm run test:e2e`.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

if (process.platform === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
  console.log("test:e2e skipped: no display found. Run it under a display, for example:");
  console.log('  xvfb-run -a --server-args="-screen 0 1280x900x24" npm run test:e2e');
  process.exit(0);
}
if (!existsSync(join(root, "out", "main", "index.cjs"))) {
  console.log("test:e2e: building first (npm run build)...");
  const b = spawnSync("npm", ["run", "build"], { cwd: root, stdio: "inherit" });
  if (b.status !== 0) process.exit(b.status ?? 1);
}
const args = ["playwright", "test", ...process.argv.slice(2)];
const r = spawnSync("npx", args, { cwd: root, stdio: "inherit", env: process.env });
process.exit(r.status ?? 1);
