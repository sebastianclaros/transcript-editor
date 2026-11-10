import { cpSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { _electron as electron, type ElectronApplication, type Page } from "@playwright/test";

export const DESKTOP = join(import.meta.dirname, "..");
export const SAMPLE = join(import.meta.dirname, "..", "..", "..", "samples", "demo-session");

export interface Launched {
  app: ElectronApplication;
  page: Page;
  session: string;
  userData: string;
}

/**
 * Launches the UNPACKAGED build (out/main/index.cjs): no ELECTRON_RENDERER_URL, so the app://
 * handler and the production CSP are under test. `--no-sandbox` is needed in CI containers only.
 */
export async function launch(
  opts: { userData?: string; session?: string } = {},
): Promise<Launched> {
  const userData = opts.userData ?? mkdtempSync(join(tmpdir(), "te-e2e-ud-"));
  const session = opts.session ?? mkdtempSync(join(tmpdir(), "te-e2e-session-"));
  if (!opts.session) cpSync(SAMPLE, session, { recursive: true });
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env))
    if (v !== undefined && k !== "ELECTRON_RENDERER_URL") env[k] = v;
  env.TRANSCRIPT_EDITOR_E2E = "1";
  const app = await electron.launch({
    args: [
      join(DESKTOP, "out", "main", "index.cjs"),
      "--no-sandbox",
      "--autoplay-policy=no-user-gesture-required",
      "--mute-audio",
      `--user-data-dir=${userData}`,
    ],
    env,
  });
  const page = await app.firstWindow();
  await page.waitForSelector("text=Transcript Editor");
  return { app, page, session, userData };
}

/** Makes the native folder dialog answer with `dir`. */
export async function stubDialog(app: ElectronApplication, dir: string): Promise<void> {
  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = (async () => ({
      canceled: false,
      filePaths: [p],
    })) as typeof dialog.showOpenDialog;
  }, dir);
}

export async function openSession(l: Launched): Promise<void> {
  await stubDialog(l.app, l.session);
  await l.page.getByRole("button", { name: "Abrir carpeta de sesión" }).click();
  await l.page.waitForSelector(".line");
  await l.page.waitForFunction(() => {
    const a = document.querySelector("audio");
    return !!a && a.readyState >= 1 && Number.isFinite(a.duration);
  });
}

export const audioTime = (page: Page) =>
  page.evaluate(() => document.querySelector("audio")!.currentTime);

/**
 * Ends the app without the close-request protocol. A dirty editor (playback marks paragraphs as
 * read) correctly waits for a human to answer the unsaved-changes dialog, so `app.close()` would
 * hang the test.
 */
export async function quit(app: ElectronApplication): Promise<void> {
  const proc = app.process();
  const closed = new Promise<void>((resolve) => {
    if (proc.exitCode !== null || proc.signalCode !== null) resolve();
    else proc.once("exit", () => resolve());
  });
  await app.evaluate(({ app: a }) => a.exit(0)).catch(() => {});
  // On CI runners the process can linger and block Playwright's worker teardown: force it.
  const timer = setTimeout(() => proc.kill("SIGKILL"), 5_000);
  await closed;
  clearTimeout(timer);
  // Playwright starts Electron in its own process group (non-Windows) and waits for its stdio to
  // close. Helpers that outlive the main process (e.g. crashpad) keep those pipes open and hang the
  // worker teardown on CI, so end the whole group.
  if (process.platform !== "win32" && proc.pid) {
    try {
      process.kill(-proc.pid, "SIGKILL");
    } catch {
      /* group already gone */
    }
  }
}
