import { HostFault } from "./fault";
import type { Registry } from "./registry";

export interface TrustCtx {
  /** Origin of the dev server, or null when the app:// handler is used. */
  devOrigin: string | null;
}

/**
 * Whether a URL is the app's own renderer. NEVER compares `URL.origin` for custom schemes (it is
 * the string "null" for non-special schemes); compares the parsed parts instead.
 */
export function isTrustedRendererUrl(raw: string, ctx: TrustCtx): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol === "app:") {
    return u.host === "renderer" && u.username === "" && u.password === "" && u.port === "";
  }
  return (
    ctx.devOrigin !== null &&
    (u.protocol === "http:" || u.protocol === "https:") &&
    u.origin === ctx.devOrigin
  );
}

export interface SenderLike {
  sender: { id: number; mainFrame: unknown };
  senderFrame: { url: string } | null;
}

/** Throws unless the IPC call comes from the main frame of a registered window showing our renderer. */
export function assertTrustedSender(event: SenderLike, registry: Registry, ctx: TrustCtx): number {
  const frame = event.senderFrame;
  if (!frame || frame !== event.sender.mainFrame)
    throw new HostFault("not_authorized", "untrusted frame");
  if (!registry.hasWindow(event.sender.id)) throw new HostFault("not_authorized", "unknown window");
  if (!isTrustedRendererUrl(frame.url, ctx)) throw new HostFault("not_authorized", "untrusted url");
  return event.sender.id;
}

/** https only, no credentials, bounded length. */
export function validateExternalUrl(raw: unknown): URL {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048)
    throw new HostFault("invalid_argument", "url");
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new HostFault("invalid_argument", "url");
  }
  if (u.protocol !== "https:" || u.username !== "" || u.password !== "" || u.hostname === "") {
    throw new HostFault("invalid_argument", "url");
  }
  return u;
}

const ALLOWED_RENDERER_SCHEMES = new Set(["app:", "app-media:", "data:", "blob:", "devtools:"]);

/** webRequest filter: renderer-originated requests may only reach our own schemes. */
export function shouldBlockRequest(
  url: string,
  fromRenderer: boolean,
  devOrigin: string | null,
): boolean {
  if (!fromRenderer) return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return true;
  }
  if (ALLOWED_RENDERER_SCHEMES.has(u.protocol)) return false;
  if (devOrigin !== null) {
    if (u.origin === devOrigin) return false;
    const dev = new URL(devOrigin);
    if ((u.protocol === "ws:" || u.protocol === "wss:") && u.host === dev.host) return false;
  }
  return true;
}

export function contentSecurityPolicy(dev: boolean, mediaScheme = "app-media"): string {
  const base = [
    "default-src 'none'",
    `script-src 'self'${dev ? " 'unsafe-inline'" : ""}`,
    `style-src 'self'${dev ? " 'unsafe-inline'" : ""}`,
    "img-src 'self' data:",
    "font-src 'self'",
    `media-src ${mediaScheme}:`,
    `connect-src 'self'${dev ? " ws://localhost:* http://localhost:*" : ""}`,
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ];
  return base.join("; ");
}

/** Allowed in-page navigation: only reloading the exact current URL. */
export function isAllowedNavigation(target: string, current: string): boolean {
  return target === current;
}
