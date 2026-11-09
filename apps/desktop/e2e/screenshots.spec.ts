import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "@playwright/test";
import { launch, openSession, quit } from "./helpers";

// Only runs with E2E_SCREENSHOTS=1 (npm run docs:screenshots). Writes docs/screenshots/*.png.
const OUT = join(import.meta.dirname, "..", "..", "..", "docs", "screenshots");

test.skip(
  process.env.E2E_SCREENSHOTS !== "1",
  "set E2E_SCREENSHOTS=1 to refresh the documentation screenshots",
);

test("documentation screenshots", async () => {
  mkdirSync(OUT, { recursive: true });
  const l = await launch();
  try {
    await l.page.setViewportSize({ width: 1280, height: 860 });
    await l.page.screenshot({ path: join(OUT, "welcome.png") });
    await openSession(l);
    await l.page.evaluate(() => {
      const a = document.querySelector("audio")!;
      a.currentTime = 22;
    });
    await l.page.waitForTimeout(600);
    await l.page.screenshot({ path: join(OUT, "editor.png") });
    await l.page.getByRole("button", { name: "Ayuda: referencias y atajos" }).click();
    await l.page.waitForTimeout(200);
    await l.page.screenshot({ path: join(OUT, "help.png") });
    await l.page.keyboard.press("Escape");
    await l.page.getByRole("button", { name: "Proyecto: hablantes, colores y datos" }).click();
    await l.page.waitForTimeout(200);
    await l.page.screenshot({ path: join(OUT, "project.png") });
  } finally {
    await quit(l.app);
  }
});
