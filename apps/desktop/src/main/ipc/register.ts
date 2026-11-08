import type { IpcMain, IpcMainInvokeEvent } from "electron";
import type { Result } from "@transcript-editor/storage";
import { CH, type InvokeChannel } from "../../shared/channels";
import { SCHEMAS } from "../../shared/schemas";
import type { CloseProtocol } from "../closeProtocol";
import { HostFault, fail, ok } from "../fault";
import type { HostService } from "../host/service";
import type { Registry } from "../registry";
import { assertTrustedSender, type TrustCtx } from "../security";

type Logger = {
  info(...a: unknown[]): void;
  warn(...a: unknown[]): void;
  error(...a: unknown[]): void;
};

export interface RegisterDeps {
  ipcMain: Pick<IpcMain, "handle">;
  registry: Registry;
  trust: TrustCtx;
  service: HostService;
  closeProtocolOf(windowId: number): CloseProtocol | undefined;
  checkUpdates(): Promise<void>;
  log: Logger;
}

const WARN = new Set(["invalid_argument", "not_authorized", "outside_project", "invalid_name"]);
const ERR = new Set(["io_error", "permission_denied"]);

/** Runs one handler: sender check, payload validation, error mapping, logging. Never throws into IPC. */
export async function runHandler<T>(
  channel: string,
  event: Pick<IpcMainInvokeEvent, "sender" | "senderFrame">,
  args: unknown[],
  deps: Pick<RegisterDeps, "registry" | "trust" | "log">,
  fn: (windowId: number, args: unknown[]) => Promise<T>,
): Promise<Result<T>> {
  try {
    const windowId = assertTrustedSender(
      event as unknown as Parameters<typeof assertTrustedSender>[0],
      deps.registry,
      deps.trust,
    );
    const schema = SCHEMAS[channel as InvokeChannel];
    if (!schema) throw new HostFault("invalid_argument", "unknown channel");
    const parsed = schema.safeParse(args);
    if (!parsed.success) throw new HostFault("invalid_argument", "payload");
    return ok(await fn(windowId, parsed.data as unknown[]));
  } catch (e) {
    if (e instanceof HostFault) {
      const url = (event.senderFrame as { url?: string } | null)?.url;
      if (WARN.has(e.code)) deps.log.warn(`ipc ${channel} rejected: ${e.code} (${e.message})`, url);
      else if (ERR.has(e.code)) deps.log.error(`ipc ${channel} failed: ${e.code}`, e.message);
      else deps.log.info(`ipc ${channel}: ${e.code}`);
      return fail({ code: e.code, message: e.message });
    }
    deps.log.error(`ipc ${channel} crashed`, e);
    return fail({ code: "io_error", message: "internal error" });
  }
}

/** Registers every invoke channel. There is no generic channel: each one is listed here. */
export function registerIpc(deps: RegisterDeps): void {
  const s = deps.service;
  // Payloads are validated by zod (SCHEMAS) before `fn` runs, so positional access is safe here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Args = [any, any, any, any];
  const on = <T>(channel: InvokeChannel, fn: (w: number, a: Args) => Promise<T>) =>
    deps.ipcMain.handle(channel, (event, ...args) =>
      runHandler(channel, event, args, deps, fn as (w: number, a: unknown[]) => Promise<T>),
    );
  on(CH.appGetInfo, () => s.appGetInfo());
  on(CH.settingsGet, () => s.settingsGet());
  on(CH.settingsUpdate, (w, [patch]) => s.settingsUpdate(w, patch));
  on(CH.recentsRemove, (w, [key]) => s.recentsRemove(w, key));
  on(CH.recentsClear, () => s.recentsClear());
  on(CH.projectPickFolder, (w) => s.pickFolder(w));
  on(CH.projectOpenRecent, (w, [key]) => s.openRecent(w, key));
  on(CH.projectOpenSample, (w) => s.openSample(w));
  on(CH.projectClose, (w, [id]) => s.closeProject(w, id));
  on(CH.projectListFiles, (w, [id]) => s.listFiles(w, id));
  on(CH.projectReadText, (w, [id, name]) => s.readText(w, id, name));
  on(CH.projectWriteText, (w, [id, name, content, opts]) =>
    s.writeText(w, id, name, content, opts),
  );
  on(CH.projectExists, (w, [id, name]) => s.exists(w, id, name));
  on(CH.projectMediaUrl, (w, [id, name]) => s.mediaUrl(w, id, name));
  on(CH.sessionGet, (w, [key]) => s.sessionGet(w, key));
  on(CH.sessionSave, (w, [key, state]) => s.sessionSave(w, key, state));
  on(CH.externalOpen, (w, [url]) => s.externalOpen(w, url));
  on(CH.updatesCheck, () => deps.checkUpdates());
  on(CH.closeDialogOpen, async (w, [open]) => {
    const cp = deps.closeProtocolOf(w);
    if (!cp || !cp.dialogOpen(open)) throw new HostFault("not_authorized", "no pending close");
  });
  on(CH.respondToClose, async (w, [allow]) => {
    const cp = deps.closeProtocolOf(w);
    if (!cp || !cp.respond(allow)) throw new HostFault("not_authorized", "no pending close");
  });
}
