import nodeFs from "node:fs/promises";
import { writeFileAtomic, type Fs } from "../fs/atomic";

export type JsonRead =
  { kind: "absent" } | { kind: "ok"; value: unknown } | { kind: "corrupt"; error: string };

export async function readJsonFile(file: string, fs: Fs = nodeFs): Promise<JsonRead> {
  let text: string;
  try {
    text = await fs.readFile(file, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return { kind: "absent" };
    return { kind: "corrupt", error: String((e as Error).message ?? e) };
  }
  try {
    return { kind: "ok", value: JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text) };
  } catch (e) {
    return { kind: "corrupt", error: (e as Error).message };
  }
}

export async function writeJsonAtomic(file: string, text: string, fs: Fs = nodeFs): Promise<void> {
  await fs.mkdir(file.replace(/[/\\][^/\\]*$/, "") || ".", { recursive: true });
  await writeFileAtomic(file, text, fs);
}

/** Renames a corrupt file to `<file>.bak` (overwriting an older backup). Returns true on success. */
export async function backupCorrupt(file: string, fs: Fs = nodeFs): Promise<boolean> {
  try {
    await fs.rename(file, `${file}.bak`);
    return true;
  } catch {
    return false;
  }
}
