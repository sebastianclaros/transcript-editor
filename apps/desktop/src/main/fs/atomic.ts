import { randomBytes } from "node:crypto";
import nodeFs from "node:fs/promises";
import path from "node:path";
import { fileKindOf } from "@transcript-editor/core";
import { MAX_LIST, MAX_TEXT_BYTES, type FileEntry } from "@transcript-editor/storage";
import { HostFault, faultFromErrno } from "../fault";

export type Fs = typeof nodeFs;

export const versionOf = (st: { mtimeMs: number; size: number }) => `${st.mtimeMs}:${st.size}`;

/**
 * Atomic write: temp file in the same directory (`wx`, so it never follows a planted symlink),
 * fsync, close, rename over the destination. On Windows `rename` is retried on EPERM/EBUSY.
 */
export async function writeFileAtomic(
  dest: string,
  data: string | Uint8Array,
  fs: Fs = nodeFs,
  platform: NodeJS.Platform = process.platform,
): Promise<void> {
  const dir = path.dirname(dest);
  const tmp = path.join(
    dir,
    `.${path.basename(dest)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`,
  );
  let fh;
  try {
    fh = await fs.open(tmp, "wx", 0o644);
    await fh.writeFile(data);
    await fh.sync();
    await fh.close();
    fh = undefined;
    const attempts = platform === "win32" ? 3 : 1;
    for (let i = 1; ; i++) {
      try {
        await fs.rename(tmp, dest);
        break;
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        if (i < attempts && (code === "EPERM" || code === "EBUSY")) {
          await new Promise((r) => setTimeout(r, 50));
          continue;
        }
        throw e;
      }
    }
  } catch (e) {
    await fh?.close().catch(() => {});
    await fs.unlink(tmp).catch(() => {});
    throw faultFromErrno(e);
  }
}

export async function listFiles(root: string, fs: Fs = nodeFs): Promise<FileEntry[]> {
  let names: string[];
  try {
    names = await fs.readdir(root);
  } catch (e) {
    throw faultFromErrno(e);
  }
  const out: FileEntry[] = [];
  for (const name of names) {
    if (name.startsWith(".")) continue;
    try {
      const st = await fs.stat(path.join(root, name));
      if (st.isFile())
        out.push({ name, kind: fileKindOf(name), size: st.size, mtimeMs: st.mtimeMs });
    } catch {
      /* vanished while listing */
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return out.slice(0, MAX_LIST);
}

export async function readTextFile(
  file: string,
  fs: Fs = nodeFs,
): Promise<{ content: string; version: string }> {
  try {
    const fh = await fs.open(file, "r");
    try {
      const st = await fh.stat();
      if (st.size > MAX_TEXT_BYTES) throw new HostFault("too_large", "file larger than 20 MiB");
      const buf = await fh.readFile();
      let content: string;
      try {
        content = new TextDecoder("utf-8", { fatal: true }).decode(buf);
      } catch {
        throw new HostFault("io_error", "invalid_utf8");
      }
      if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);
      return { content, version: versionOf(st) };
    } finally {
      await fh.close();
    }
  } catch (e) {
    throw faultFromErrno(e);
  }
}

/** Version rules of design section 2: absent ifVersion = unconditional; stale or deleted = conflict. */
export async function writeTextFile(
  file: string,
  content: string,
  ifVersion: string | undefined,
  fs: Fs = nodeFs,
): Promise<{ version: string }> {
  if (Buffer.byteLength(content, "utf8") > MAX_TEXT_BYTES)
    throw new HostFault("too_large", "content larger than 20 MiB");
  if (ifVersion !== undefined) {
    let st;
    try {
      st = await fs.stat(file);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT")
        throw new HostFault("conflict", "file was deleted");
      throw faultFromErrno(e);
    }
    if (versionOf(st) !== ifVersion) throw new HostFault("conflict", "file changed on disk");
  }
  await writeFileAtomic(file, content, fs);
  try {
    return { version: versionOf(await fs.stat(file)) };
  } catch (e) {
    throw faultFromErrno(e);
  }
}
