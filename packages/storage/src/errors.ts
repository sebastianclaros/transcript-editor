import type { HostError, HostErrorCode } from "./host";

export type StorageErrorCode = HostErrorCode | "auth_required" | "offline" | "rate_limited";

/** One error type for the UI to catch, whatever the provider. */
export class StorageError extends Error {
  readonly code: StorageErrorCode;
  constructor(code: StorageErrorCode, message: string) {
    super(message);
    this.name = "StorageError";
    this.code = code;
  }
  static fromHost(e: HostError): StorageError {
    return new StorageError(e.code, e.message);
  }
}

export function isStorageError(e: unknown): e is StorageError {
  return e instanceof StorageError;
}
