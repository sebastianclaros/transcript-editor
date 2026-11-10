import { createHash } from "node:crypto";
import nodeFs from "node:fs/promises";
import path from "node:path";
import { fileKindOf, validateFileName } from "@transcript-editor/core";
import { HostFault, faultFromErrno } from "../fault";

export type Fs = Pick<typeof nodeFs, "realpath" | "stat" | "lstat">;
export type Mode = "read" | "write" | "media";

const TEXT_EXT = new Set([".txt", ".json"]);
const MEDIA_EXT = new Set([".mp4", ".m4a", ".mp3", ".wav", ".ogg"]);

/** sha256(realpath) first 32 hex chars: stable key of a project across runs. */
export function projectKeyOf(realPath: string): string {
  return createHash("sha256").update(realPath).digest("hex").slice(0, 32);
}

/** Strips the Win32 extended-length prefix (question-mark form, plain or UNC) so both sides compare alike. */
function stripExtendedPrefix(p: string): string {
  if (p.startsWith("\\\\?\\UNC\\")) return "\\\\" + p.slice(8);
  if (p.startsWith("\\\\?\\")) return p.slice(4);
  return p;
}
/**
 * True when `real` is strictly inside `root`. Both must already be real paths (fs.realpath, which
 * expands 8.3 short names on Windows). On win32 the comparison uses win32 path rules (separators,
 * drive-letter case, `\\?\` prefix) and is case-insensitive; elsewhere it is exact (a false
 * "outside" is the safe failure mode on case-insensitive macOS volumes).
 */
export function isInside(
  root: string,
  real: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  const win = platform === "win32";
  const p = win ? path.win32 : path.posix;
  const a = win ? p.normalize(stripExtendedPrefix(root)).toLowerCase() : root;
  const b = win ? p.normalize(stripExtendedPrefix(real)).toLowerCase() : real;
  const rel = p.relative(a, b);
  return rel !== "" && rel !== ".." && !rel.startsWith(".." + p.sep) && !p.isAbsolute(rel);
}
async function realOrResolved(fs: Fs, p: string): Promise<string> {
  try {
    return await fs.realpath(p);
  } catch {
    return path.resolve(p);
  }
}

export interface AuthDeps {
  fs?: Fs;
  userData: string;
  logs: string;
  platform?: NodeJS.Platform;
}

/**
 * Validates a folder chosen by the user (via the native dialog, recents or the sample copy).
 * Rejects filesystem roots and any folder that equals, contains or is inside userData / logs.
 */
export async function authorizeRoot(
  chosen: string,
  deps: AuthDeps,
): Promise<{ root: string; key: string }> {
  const fs = deps.fs ?? nodeFs;
  let real: string;
  try {
    real = await fs.realpath(chosen);
  } catch (e) {
    throw faultFromErrno(e);
  }
  let st;
  try {
    st = await fs.stat(real);
  } catch (e) {
    throw faultFromErrno(e);
  }
  if (!st.isDirectory()) throw new HostFault("invalid_argument", "not a directory");
  if (path.parse(real).root === real) throw new HostFault("invalid_argument", "filesystem root");
  const platform = deps.platform ?? process.platform;
  for (const protectedDir of [deps.userData, deps.logs]) {
    const p = await realOrResolved(fs, protectedDir);
    const same = platform === "win32" ? p.toLowerCase() === real.toLowerCase() : p === real;
    if (same || isInside(p, real, platform) || isInside(real, p, platform)) {
      throw new HostFault("invalid_argument", "folder overlaps application data");
    }
  }
  return { root: real, key: projectKeyOf(real) };
}

/**
 * Resolves a flat file name inside an authorized project root, with containment checks.
 * Returns the absolute path or throws HostFault.
 */
export async function resolveInProject(
  root: string,
  name: string,
  mode: Mode,
  fs: Fs = nodeFs,
): Promise<string> {
  const check = validateFileName(name);
  if (!check.ok) throw new HostFault("invalid_name", check.reason);
  const ext = path.extname(name).toLowerCase();
  if (mode === "media" ? !MEDIA_EXT.has(ext) : !TEXT_EXT.has(ext))
    throw new HostFault("invalid_name", "extension");
  const candidate = path.join(root, name);
  if (mode === "write") {
    try {
      const st = await fs.lstat(candidate);
      if (!st.isFile()) throw new HostFault("outside_project", "not a regular file");
    } catch (e) {
      if (e instanceof HostFault) throw e;
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw faultFromErrno(e);
    }
    return candidate;
  }
  let real: string;
  try {
    real = await fs.realpath(candidate);
  } catch (e) {
    throw faultFromErrno(e);
  }
  if (!isInside(root, real)) throw new HostFault("outside_project", "escapes the project folder");
  if (mode === "media") {
    const st = await fs.stat(real).catch((e: unknown) => {
      throw faultFromErrno(e);
    });
    if (!st.isFile()) throw new HostFault("outside_project", "not a regular file");
  }
  return real;
}

export { fileKindOf };
