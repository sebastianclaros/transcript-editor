/**
 * Close-request protocol (design 8). Pure state machine with injected side effects so every
 * branch is unit-testable with fake windows and fake timers.
 */
export interface CloseDeps {
  /** Renderer is in the `ready` state and alive. */
  rendererReady(): boolean;
  sendCloseRequested(): void;
  /** Close the window for real (sets the approved flag first). */
  closeWindow(): void;
  /** An in-progress app quit must be cancelled (a window answered `false`). */
  abortQuit(): void;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(t: unknown): void;
  log?: { warn(...a: unknown[]): void };
}

export const CLOSE_TIMEOUT_MS = 10_000;

export class CloseProtocol {
  private pending: { timer: unknown | null } | null = null;
  approved = false;

  constructor(private readonly deps: CloseDeps) {}

  get isPending(): boolean {
    return this.pending !== null;
  }

  /** Called from `win.on("close")`. Returns true when the close may proceed immediately. */
  onWindowClose(): boolean {
    if (this.approved) return true;
    if (this.pending) return false;
    if (!this.deps.rendererReady()) {
      this.approved = true;
      return true;
    }
    this.pending = { timer: this.deps.setTimer(() => this.timeout(), CLOSE_TIMEOUT_MS) };
    this.deps.sendCloseRequested();
    return false;
  }

  /** The renderer's unsaved-changes dialog is up: a human is deciding, stop the timer. */
  dialogOpen(open: boolean): boolean {
    if (!this.pending) return false;
    if (open && this.pending.timer !== null) {
      this.deps.clearTimer(this.pending.timer);
      this.pending.timer = null;
    }
    return true;
  }

  /** Renderer answer. Rejected (false) unless a request is pending. */
  respond(allow: boolean): boolean {
    if (!this.pending) return false;
    if (this.pending.timer !== null) this.deps.clearTimer(this.pending.timer);
    this.pending = null;
    if (allow) {
      this.approved = true;
      this.deps.closeWindow();
    } else {
      this.deps.abortQuit();
    }
    return true;
  }

  /** Renderer crashed or hung while a request was pending: force the close. */
  rendererGone(): void {
    if (!this.pending) return;
    this.deps.log?.warn("renderer gone while closing; unsaved edits are lost");
    this.force();
  }

  private timeout(): void {
    if (!this.pending) return;
    this.deps.log?.warn("renderer did not answer the close request in time");
    this.force();
  }

  private force(): void {
    if (this.pending?.timer != null) this.deps.clearTimer(this.pending.timer);
    this.pending = null;
    this.approved = true;
    this.deps.closeWindow();
  }
}

export function shouldQuitOnAllClosed(platform: NodeJS.Platform): boolean {
  return platform !== "darwin";
}
