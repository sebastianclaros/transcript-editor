import nodeFs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { validateFileName } from "@transcript-editor/core";
import { HostFault } from "../fault";
import { resolveInProject } from "../fs/authorize";
import type { Registry } from "../registry";
import { isTrustedRendererUrl, type TrustCtx } from "../security";
import { MEDIA_TYPES, parseRange } from "./range";

export interface MediaRequest {
  method: string;
  url: string;
  headers: { get(name: string): string | null };
  signal?: AbortSignal;
}

export interface MediaDeps {
  registry: Registry;
  trust: TrustCtx;
  fs?: typeof nodeFs;
  log?: { warn(...a: unknown[]): void };
  /** Test hook: counts of responses by status (exposed only when TRANSCRIPT_EDITOR_E2E=1 and unpackaged). */
  onResponse?: (status: number) => void;
}

const BASE_HEADERS = {
  "Accept-Ranges": "bytes",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
} as const;

/** Parses `app-media://media/<projectId>/<encodedName>`. Returns null when malformed. */
export function parseMediaUrl(raw: string): { projectId: string; name: string } | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.hostname !== "media" || u.username !== "" || u.password !== "" || u.port !== "")
    return null;
  const segments = u.pathname.split("/");
  if (segments.length !== 3 || segments[0] !== "") return null;
  const projectId = segments[1] ?? "";
  const encoded = segments[2] ?? "";
  if (!/^[0-9a-f]{32}$/.test(projectId)) return null;
  let name: string;
  try {
    name = decodeURIComponent(encoded);
  } catch {
    return null;
  }
  if (!validateFileName(name).ok) return null;
  return { projectId, name };
}

export function buildMediaUrl(scheme: string, projectId: string, name: string): string {
  return `${scheme}://media/${projectId}/${encodeURIComponent(name)}`;
}

function status(
  deps: MediaDeps,
  code: number,
  init: ResponseInit = {},
  body: BodyInit | null = null,
): Response {
  deps.onResponse?.(code);
  return new Response(body, { status: code, ...init });
}

/**
 * Implements `protocol.handle("app-media")` with a hand-written HTTP Range, because
 * `net.fetch(file://)` breaks seeking in Electron (issue 38749).
 */
export async function handleMediaRequest(req: MediaRequest, deps: MediaDeps): Promise<Response> {
  const fs = deps.fs ?? nodeFs;
  if (req.method !== "GET" && req.method !== "HEAD") {
    return status(deps, 405, { headers: { Allow: "GET, HEAD" } });
  }
  const parsed = parseMediaUrl(req.url);
  if (!parsed) return status(deps, 400);
  const project = deps.registry.findProject(parsed.projectId);
  if (!project) return status(deps, 404);
  // Defense in depth only: the Referer is often absent for custom schemes.
  const referer = req.headers.get("Referer");
  if (referer && !isTrustedRendererUrl(referer, deps.trust)) return status(deps, 403);

  let real: string;
  try {
    real = await resolveInProject(project.root, parsed.name, "media", fs);
  } catch (e) {
    const code = e instanceof HostFault ? e.code : "io_error";
    return status(deps, code === "not_found" ? 404 : code === "io_error" ? 500 : 403);
  }
  let fh;
  try {
    fh = await fs.open(real, "r");
  } catch {
    return status(deps, 404);
  }
  let handedOver = false;
  try {
    const st = await fh.stat();
    if (!st.isFile()) return status(deps, 403);
    const size = st.size;
    const contentType = MEDIA_TYPES[path.extname(real).toLowerCase()] ?? "application/octet-stream";
    const range = parseRange(req.headers.get("Range"), size);
    const headers: Record<string, string> = { ...BASE_HEADERS, "Content-Type": contentType };
    if (range.kind === "unsatisfiable") {
      return status(deps, 416, {
        headers: { ...headers, "Content-Range": `bytes */${size}`, "Content-Length": "0" },
      });
    }
    let code = 200;
    let start = 0;
    let end = size - 1;
    if (range.kind === "partial") {
      code = 206;
      start = range.start;
      end = range.end;
      headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
    }
    headers["Content-Length"] = String(size === 0 ? 0 : end - start + 1);
    if (req.method === "HEAD" || size === 0) return status(deps, code, { headers });
    const stream = fh.createReadStream({ start, end, highWaterMark: 256 * 1024, autoClose: true });
    handedOver = true;
    req.signal?.addEventListener("abort", () => stream.destroy(), { once: true });
    stream.on("error", (e) => {
      deps.log?.warn("media stream error", (e as NodeJS.ErrnoException).code);
      stream.destroy();
    });
    return status(deps, code, { headers }, Readable.toWeb(stream) as unknown as BodyInit);
  } finally {
    if (!handedOver) await fh.close().catch(() => {});
  }
}
