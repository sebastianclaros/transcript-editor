import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import nodeFs from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { HostFault } from "../src/main/fault";
import { listFiles, readTextFile, writeFileAtomic, writeTextFile } from "../src/main/fs/atomic";
import { authorizeRoot, isInside, projectKeyOf, resolveInProject } from "../src/main/fs/authorize";
import { tempDir } from "./helpers";

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof HostFault ? e.code : `other:${String(e)}`;
  }
};

describe("resolveInProject", () => {
  function project() {
    const root = realpathSync(tempDir());
    writeFileSync(join(root, "a.txt"), "x");
    writeFileSync(join(root, "a.json"), "{}");
    writeFileSync(join(root, "a.m4a"), "m");
    const outside = realpathSync(tempDir());
    writeFileSync(join(outside, "secret.txt"), "secret");
    return { root, outside };
  }

  it("resolves plain names", async () => {
    const { root } = project();
    expect(await resolveInProject(root, "a.txt", "read")).toBe(join(root, "a.txt"));
    expect(await resolveInProject(root, "a.m4a", "media")).toBe(join(root, "a.m4a"));
    expect(await resolveInProject(root, "new.json", "write")).toBe(join(root, "new.json"));
  });

  it.each([
    "../a.txt",
    "/etc/passwd",
    "a\u0000.txt",
    "sub/a.txt",
    "..",
    ".",
    ".hidden.txt",
    "CON.txt",
    "nul",
    "a:b.txt",
    "a.txt ",
    "a.txt.",
  ])("rejects the name %j", async (name) => {
    const { root } = project();
    for (const mode of ["read", "write", "media"] as const) {
      expect(await code(resolveInProject(root, name, mode)), `${mode}:${name}`).toBe(
        "invalid_name",
      );
    }
  });

  it("enforces extension allow-lists per mode", async () => {
    const { root } = project();
    expect(await code(resolveInProject(root, "a.m4a", "read"))).toBe("invalid_name");
    expect(await code(resolveInProject(root, "a.m4a", "write"))).toBe("invalid_name");
    expect(await code(resolveInProject(root, "a.txt", "media"))).toBe("invalid_name");
    expect(await code(resolveInProject(root, "x.exe", "read"))).toBe("invalid_name");
  });

  it("reports not_found for reads of missing files", async () => {
    const { root } = project();
    expect(await code(resolveInProject(root, "nope.txt", "read"))).toBe("not_found");
  });

  it("rejects symlinks that escape the folder (read) and writes through symlinks", async () => {
    const { root, outside } = project();
    symlinkSync(join(outside, "secret.txt"), join(root, "link.txt"));
    expect(await code(resolveInProject(root, "link.txt", "read"))).toBe("outside_project");
    expect(await code(resolveInProject(root, "link.txt", "write"))).toBe("outside_project");
    mkdirSync(join(root, "dir.txt"));
    expect(await code(resolveInProject(root, "dir.txt", "write"))).toBe("outside_project");
  });

  it("rejects a symlinked directory in place of a file name too", async () => {
    const { root, outside } = project();
    symlinkSync(outside, join(root, "evil.json"));
    expect(await code(resolveInProject(root, "evil.json", "write"))).toBe("outside_project");
    expect(await code(resolveInProject(root, "evil.json", "read"))).toBe("outside_project");
  });

  it("isInside handles prefixes and windows case-insensitivity", () => {
    expect(isInside("/a/b", "/a/b/c", "linux")).toBe(true);
    expect(isInside("/a/b", "/a/bc", "linux")).toBe(false);
    expect(isInside("/a/b", "/a/b", "linux")).toBe(false);
    expect(isInside("/a/b", "/a/b/..c", "linux")).toBe(true); // a name starting with dots is not traversal
    expect(isInside("/a/b", "/a/c", "linux")).toBe(false);
    expect(isInside("/a/b", "/a/B/c", "linux")).toBe(false); // exact on posix
  });
  it("isInside applies win32 rules: drive-letter case, separators, prefix, siblings, other drives", () => {
    const w = "win32" as const;
    expect(isInside("C:\\Data", "c:\\data\\x", w)).toBe(true);
    expect(isInside("C:\\Data\\", "C:/Data/x/y.mp4", w)).toBe(true);
    expect(isInside("\\\\?\\C:\\Data", "C:\\Data\\x", w)).toBe(true);
    expect(isInside("\\\\?\\UNC\\h\\s\\d", "\\\\h\\s\\d\\x", w)).toBe(true);
    expect(isInside("C:\\Data", "C:\\Data", w)).toBe(false);
    expect(isInside("C:\\Data", "C:\\Data2\\x", w)).toBe(false);
    expect(isInside("C:\\Data", "C:\\Data\\..\\Other\\x", w)).toBe(false);
    expect(isInside("C:\\Data", "D:\\Data\\x", w)).toBe(false);
    expect(isInside("C:\\Data", "\\\\other\\share\\x", w)).toBe(false);
  });
});

describe("authorizeRoot", () => {
  it("accepts a normal folder and computes a stable 32-hex key", async () => {
    const root = realpathSync(tempDir());
    const userData = realpathSync(tempDir());
    const a = await authorizeRoot(root, { userData, logs: join(userData, "logs") });
    expect(a.root).toBe(root);
    expect(a.key).toMatch(/^[0-9a-f]{32}$/);
    expect(a.key).toBe(projectKeyOf(root));
  });
  it("rejects files, missing paths, filesystem roots, and folders overlapping userData/logs", async () => {
    const root = realpathSync(tempDir());
    const userData = join(realpathSync(tempDir()), "ud");
    mkdirSync(join(userData, "logs"), { recursive: true });
    writeFileSync(join(root, "f.txt"), "x");
    const deps = { userData, logs: join(userData, "logs") };
    expect(await code(authorizeRoot(join(root, "f.txt"), deps))).toBe("invalid_argument");
    expect(await code(authorizeRoot(join(root, "missing"), deps))).toBe("not_found");
    expect(await code(authorizeRoot("/", deps))).toBe("invalid_argument");
    expect(await code(authorizeRoot(userData, deps))).toBe("invalid_argument");
    expect(await code(authorizeRoot(join(userData, "logs"), deps))).toBe("invalid_argument");
    // an ancestor of userData (like the home folder) is refused too
    expect(await code(authorizeRoot(join(userData, ".."), deps))).toBe("invalid_argument");
  });
});

describe("atomic writes and reads", () => {
  it("writes atomically and leaves no temp files", async () => {
    const dir = realpathSync(tempDir());
    await writeFileAtomic(join(dir, "a.txt"), "hola");
    expect(readFileSync(join(dir, "a.txt"), "utf8")).toBe("hola");
    expect(readdirSync(dir)).toEqual(["a.txt"]);
  });

  it("cleans up the temp file when rename fails", async () => {
    const dir = realpathSync(tempDir());
    const failing = {
      ...nodeFs,
      rename: async () => Promise.reject(Object.assign(new Error("boom"), { code: "EIO" })),
    } as typeof nodeFs;
    expect(await code(writeFileAtomic(join(dir, "a.txt"), "x", failing))).toBe("io_error");
    expect(readdirSync(dir)).toEqual([]);
  });

  it("maps permission errors", async () => {
    const dir = realpathSync(tempDir());
    chmodSync(dir, 0o500);
    try {
      const c = await code(writeFileAtomic(join(dir, "a.txt"), "x"));
      // root can write anywhere; only assert the mapping when the OS enforced it
      expect(["permission_denied", "ok"]).toContain(c);
    } finally {
      chmodSync(dir, 0o700);
    }
  });

  it("handles concurrent writes without torn files", async () => {
    const dir = realpathSync(tempDir());
    const file = join(dir, "c.txt");
    const payloads = Array.from({ length: 20 }, (_, i) => `contenido ${i} ` + "x".repeat(10_000));
    await Promise.all(payloads.map((p) => writeFileAtomic(file, p)));
    expect(payloads).toContain(readFileSync(file, "utf8"));
    expect(readdirSync(dir)).toEqual(["c.txt"]);
  });

  it("follows the version rules (create, stale, deleted, unconditional)", async () => {
    const dir = realpathSync(tempDir());
    const file = join(dir, "v.txt");
    const first = await writeTextFile(file, "uno", undefined);
    const read = await readTextFile(file);
    expect(read).toEqual({ content: "uno", version: first.version });
    const second = await writeTextFile(file, "dos veces", first.version); // different size: mtime alone can tie within one fs tick
    expect(second.version).not.toBe(first.version);
    expect(await code(writeTextFile(file, "tres", first.version))).toBe("conflict");
    writeFileSync(file, "externo con otro tamaño");
    expect(await code(writeTextFile(file, "cuatro", second.version))).toBe("conflict");
    expect(await code(writeTextFile(join(dir, "missing.txt"), "x", "1:1"))).toBe("conflict");
    await writeTextFile(file, "forzado", undefined);
    expect(readFileSync(file, "utf8")).toBe("forzado");
  });

  it("reads UTF-8, strips the BOM, rejects invalid UTF-8 and oversized content", async () => {
    const dir = realpathSync(tempDir());
    writeFileSync(join(dir, "bom.txt"), "\ufeffñandú");
    expect((await readTextFile(join(dir, "bom.txt"))).content).toBe("ñandú");
    writeFileSync(join(dir, "bad.txt"), Buffer.from([0xff, 0xfe, 0xfd]));
    expect(await code(readTextFile(join(dir, "bad.txt")))).toBe("io_error");
    expect(await code(readTextFile(join(dir, "missing.txt")))).toBe("not_found");
    expect(
      await code(writeTextFile(join(dir, "big.txt"), "x".repeat(20 * 1024 * 1024 + 1), undefined)),
    ).toBe("too_large");
    expect(existsSync(join(dir, "big.txt"))).toBe(false);
  });

  it("lists regular files only, hides dotfiles, sorts naturally", async () => {
    const dir = realpathSync(tempDir());
    for (const n of ["b10.txt", "b2.txt", "a.m4a", ".hidden", "c.json"])
      writeFileSync(join(dir, n), "x");
    mkdirSync(join(dir, "subdir"));
    const list = await listFiles(dir);
    expect(list.map((f) => f.name)).toEqual(["a.m4a", "b2.txt", "b10.txt", "c.json"]);
    expect(list.map((f) => f.kind)).toEqual(["audio", "text", "text", "json"]);
  });
});
