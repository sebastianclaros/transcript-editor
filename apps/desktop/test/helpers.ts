import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach } from "vitest";

const dirs: string[] = [];
export function tempDir(prefix = "te-test-"): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  dirs.push(d);
  // Native realpath expands Windows 8.3 short names (RUNNER~1), like fs.promises.realpath does in product code.
  return realpathSync.native(d);
}
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

export const silentLog = { info: () => {}, warn: () => {}, error: () => {} };
