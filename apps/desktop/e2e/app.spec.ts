import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { launch, openSession, audioTime, quit, SAMPLE } from "./helpers";

test("opens the sample session and shows the project", async () => {
  const l = await launch();
  try {
    await openSession(l);
    await expect(l.page.locator(".line")).toHaveCount(10);
    await expect(l.page.locator(".speaker").first()).toHaveText("Lucía Prado");
    await expect(l.page.getByText("Huerta comunitaria (demo)").first()).toBeVisible();
  } finally {
    await quit(l.app);
  }
});

test("seeking sticks (Electron range bug 38749) and the media handler answers 206", async () => {
  const l = await launch();
  try {
    await openSession(l);
    await l.page.locator(".line").nth(4).locator(".time").click(); // 00:30
    await expect.poll(() => audioTime(l.page)).toBeGreaterThan(29.5);
    expect(
      await l.page.evaluate(() => document.querySelector("audio")!.seekable.length),
    ).toBeGreaterThan(0);
    // seek again with the slider, backwards: a broken range handler snaps back to 0
    await l.page.evaluate(() => {
      const a = document.querySelector("audio")!;
      a.pause();
      a.currentTime = 12;
    });
    await expect.poll(() => audioTime(l.page)).toBeCloseTo(12, 0);
    await l.page.waitForTimeout(500);
    expect(await audioTime(l.page)).toBeGreaterThan(11.5);
    const stats = await l.app.evaluate(
      () => (globalThis as unknown as { __mediaStats: Record<string, number> }).__mediaStats,
    );
    expect(stats[206]).toBeGreaterThanOrEqual(1);
  } finally {
    await quit(l.app);
  }
});

test("playback advances and marks paragraphs as read", async () => {
  const l = await launch();
  try {
    await openSession(l);
    await l.page.keyboard.press("Control+Space");
    await expect.poll(() => audioTime(l.page), { timeout: 15_000 }).toBeGreaterThan(1);
    await expect(l.page.locator(".line").first()).toHaveClass(/active/);
    await l.page.keyboard.press("Control+Space");
  } finally {
    await quit(l.app);
  }
});

test("hotkeys: nudge, verify, speed", async () => {
  const l = await launch();
  try {
    await openSession(l);
    await l.page.keyboard.press("Control+ArrowRight");
    await expect.poll(() => audioTime(l.page)).toBeCloseTo(5, 0);
    await l.page.keyboard.press("Control+ArrowRight");
    await expect.poll(() => audioTime(l.page)).toBeCloseTo(10, 0); // inside paragraph 1 (7 s)
    await l.page.keyboard.press("Control+Enter");
    await expect(l.page.locator(".line.est-verificado")).toHaveCount(2); // paragraph 0 was already verified in the sample
    await l.page.keyboard.press("Control+Shift+Period");
    await expect(l.page.getByRole("button", { name: "Velocidad 1.5 veces" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await l.page.evaluate(() => document.querySelector("audio")!.playbackRate)).toBe(1.5);
  } finally {
    await quit(l.app);
  }
});

test("edit, save with Ctrl+S, files on disk keep the paragraph count; reopen restores position", async () => {
  const l = await launch();
  const text = l.page.locator(".line").nth(2).locator(".text");
  try {
    await openSession(l);
    await text.click();
    await l.page.keyboard.press("End");
    await l.page.keyboard.type(" Gracias.");
    await l.page.locator(".line").nth(3).locator(".time").click({ delay: 10 }); // blur + seek/play
    await l.page.keyboard.press("Control+s");
    await expect(l.page.locator(".status").first()).toContainText("Guardado");
    const saved = readFileSync(join(l.session, "demo.txt"), "utf8").split("\n").filter(Boolean);
    expect(saved).toHaveLength(10);
    expect(saved[2]).toContain("Gracias.");
    const meta = JSON.parse(readFileSync(join(l.session, "demo.meta.json"), "utf8"));
    expect(meta).toHaveLength(10);
    expect(meta[2].estado).toBe("corregido");
    // pause somewhere and quit; the next launch restores the project, position and speed
    await l.page.evaluate(() => {
      const a = document.querySelector("audio")!;
      a.pause();
      a.currentTime = 33;
    });
    await l.page.waitForTimeout(800);
  } finally {
    await quit(l.app);
  }
  const again = await launch({ userData: l.userData, session: l.session });
  try {
    await again.page.waitForSelector(".line");
    await expect.poll(() => audioTime(again.page), { timeout: 15_000 }).toBeGreaterThan(30);
  } finally {
    await quit(again.app);
  }
  // userData holds config.json and state.json; the project folder got only the allowed files
  expect(readdirSync(l.userData)).toEqual(expect.arrayContaining(["config.json", "state.json"]));
  expect(readdirSync(l.session).sort()).toEqual([
    "README.md",
    "demo.m4a",
    "demo.meta.json",
    "demo.txt",
    "proyecto.json",
  ]);
});

test("creates proyecto.json for a new folder through the dialogs", async () => {
  const session = mkdtempSync(join(tmpdir(), "te-e2e-new-"));
  mkdirSync(session, { recursive: true });
  for (const f of ["demo.m4a", "demo.txt", "demo.meta.json"])
    writeFileSync(join(session, f), readFileSync(join(SAMPLE, f)));
  const l = await launch({ session });
  try {
    await l.app.evaluate(({ dialog }, p) => {
      dialog.showOpenDialog = (async () => ({
        canceled: false,
        filePaths: [p],
      })) as typeof dialog.showOpenDialog;
    }, session);
    await l.page.getByRole("button", { name: "Abrir carpeta de sesión" }).click();
    await l.page.getByRole("button", { name: "Crear", exact: true }).click();
    await l.page.getByRole("button", { name: "Abrir sesión", exact: true }).click();
    await l.page.waitForSelector(".line");
    await l.page.getByRole("button", { name: "Cerrar" }).click();
    await l.page.keyboard.press("Control+s");
    await expect.poll(() => readdirSync(session)).toContain("proyecto.json");
  } finally {
    await quit(l.app);
  }
});

test("security: no node in the renderer, narrow window.host, external network blocked", async () => {
  const l = await launch();
  try {
    expect(
      await l.page.evaluate(() => typeof (window as unknown as { require?: unknown }).require),
    ).toBe("undefined");
    expect(
      await l.page.evaluate(() => typeof (window as unknown as { process?: unknown }).process),
    ).toBe("undefined");
    const keys = await l.page.evaluate(() =>
      Object.keys((window as unknown as { host: object }).host).sort(),
    );
    expect(keys).toEqual([
      "app",
      "external",
      "lifecycle",
      "platform",
      "project",
      "recents",
      "session",
      "settings",
      "updates",
    ]);
    const fetched = await l.page.evaluate(() =>
      fetch("https://example.com").then(
        () => "reached",
        () => "blocked",
      ),
    );
    expect(fetched).toBe("blocked");
    const csp = await l.page.evaluate(async () =>
      (await fetch("app://renderer/index.html")).headers.get("content-security-policy"),
    );
    expect(csp).toContain("default-src 'none'");
    const pagesBefore = l.app.windows().length;
    await l.page.evaluate(() => window.open("https://example.com"));
    await l.page.waitForTimeout(300);
    expect(l.app.windows().length).toBe(pagesBefore);
  } finally {
    await quit(l.app);
  }
});

test("a second instance on the same user data exits while the first stays alive", async () => {
  const l = await launch();
  try {
    const { spawnSync } = await import("node:child_process");
    const electronPath = await l.app.evaluate(({ app }) => app.getPath("exe"));
    const r = spawnSync(
      electronPath,
      [
        join(import.meta.dirname, "..", "out", "main", "index.cjs"),
        "--no-sandbox",
        `--user-data-dir=${l.userData}`,
      ],
      {
        timeout: 20_000,
        encoding: "utf8",
      },
    );
    expect(r.status).toBe(0);
    await expect(l.page.locator("text=Transcript Editor").first()).toBeVisible();
  } finally {
    await quit(l.app);
  }
});
