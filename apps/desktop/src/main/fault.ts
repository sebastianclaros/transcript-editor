import type { HostError, HostErrorCode, Result } from "@transcript-editor/storage";

/** Error thrown inside main; the IPC wrapper turns it into a `Result` error. */
export class HostFault extends Error {
  constructor(
    readonly code: HostErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "HostFault";
  }
}

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = (error: HostError): Result<never> => ({ ok: false, error });

/** Maps node fs errors to HostFault (never leaks paths to the renderer). */
export function faultFromErrno(e: unknown): HostFault {
  if (e instanceof HostFault) return e;
  const code = (e as NodeJS.ErrnoException | null)?.code;
  if (code === "ENOENT" || code === "ENOTDIR") return new HostFault("not_found", String(code));
  if (code === "EACCES" || code === "EPERM" || code === "EROFS")
    return new HostFault("permission_denied", String(code));
  if (code === "ENOSPC" || code === "EDQUOT") return new HostFault("io_error", String(code));
  return new HostFault("io_error", typeof code === "string" ? code : "io_error");
}
