import nodeFs from "node:fs/promises";
import path from "node:path";
import { BRAND } from "@transcript-editor/core";
import { HostFault, faultFromErrno } from "../fault";
import { writeFileAtomic, type Fs } from "../fs/atomic";

/**
 * Copies the bundled sample into `<Documents>/<productName> Demo` (design 2 "openSample").
 * Never overwrites: existing files (the user's edits) survive. A non-directory in the way
 * moves us to "... Demo 2" up to 20.
 */
export async function ensureSample(opts: {
  sourceDir: string;
  documentsDir: string;
  fs?: Fs;
}): Promise<string> {
  const fs = opts.fs ?? nodeFs;
  try {
    const names = (await fs.readdir(opts.sourceDir)).filter((n) => !n.startsWith("."));
    if (names.length === 0) throw new HostFault("not_found", "sample is empty");
    let target = "";
    for (let n = 1; n <= 20; n++) {
      const candidate = path.join(
        opts.documentsDir,
        `${BRAND.productName} Demo${n === 1 ? "" : ` ${n}`}`,
      );
      let st;
      try {
        st = await fs.stat(candidate);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") {
          await fs.mkdir(candidate, { recursive: true });
          target = candidate;
          break;
        }
        throw e;
      }
      if (st.isDirectory()) {
        target = candidate;
        break;
      }
    }
    if (!target) throw new HostFault("io_error", "no free demo folder name");
    for (const name of names) {
      const dest = path.join(target, name);
      const exists = await fs.stat(dest).then(
        () => true,
        () => false,
      );
      if (exists) continue;
      const data = await fs.readFile(path.join(opts.sourceDir, name));
      await writeFileAtomic(dest, data, fs);
    }
    return target;
  } catch (e) {
    throw e instanceof HostFault ? e : faultFromErrno(e);
  }
}
