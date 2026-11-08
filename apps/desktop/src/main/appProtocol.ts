import nodeFs from "node:fs/promises";
import path from "node:path";
import { isInside } from "./fs/authorize";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

/**
 * Serves the packaged renderer from `app://renderer/...` with realpath containment, GET/HEAD
 * only, and the Content-Security-Policy as a response header.
 */
export async function handleAppRequest(
  req: { method: string; url: string },
  rendererRoot: string,
  csp: string,
  fs: typeof nodeFs = nodeFs,
): Promise<Response> {
  const headers = {
    "Content-Security-Policy": csp,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response(null, { status: 405, headers: { ...headers, Allow: "GET, HEAD" } });
  }
  let u: URL;
  try {
    u = new URL(req.url);
  } catch {
    return new Response(null, { status: 400, headers });
  }
  if (u.hostname !== "renderer" || u.username !== "" || u.password !== "" || u.port !== "") {
    return new Response(null, { status: 400, headers });
  }
  let rel: string;
  try {
    rel = decodeURIComponent(u.pathname);
  } catch {
    return new Response(null, { status: 400, headers });
  }
  if (rel === "/" || rel === "") rel = "/index.html";
  if (rel.includes("\0")) return new Response(null, { status: 400, headers });
  try {
    const root = await fs.realpath(rendererRoot);
    const real = await fs.realpath(path.join(root, rel));
    if (!isInside(root, real)) return new Response(null, { status: 404, headers });
    const st = await fs.stat(real);
    if (!st.isFile()) return new Response(null, { status: 404, headers });
    const type = TYPES[path.extname(real).toLowerCase()] ?? "application/octet-stream";
    const h = { ...headers, "Content-Type": type, "Content-Length": String(st.size) };
    if (req.method === "HEAD") return new Response(null, { status: 200, headers: h });
    return new Response(new Uint8Array(await fs.readFile(real)), { status: 200, headers: h });
  } catch {
    return new Response(null, { status: 404, headers });
  }
}
