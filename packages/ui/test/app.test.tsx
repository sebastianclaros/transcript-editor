import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src";
import { makeHost, sessionFiles, TEXT } from "./fixtures";
import type { MemoryHost } from "@transcript-editor/storage/testing";

const ctrl = (code: string, key: string, extra: Partial<KeyboardEventInit> = {}) =>
  fireEvent.keyDown(window, { code, key, ctrlKey: true, ...extra });

const audio = () => document.querySelector("audio") as HTMLAudioElement;
const line = (n: number) => document.querySelector(`.line[data-id="${n}"]`) as HTMLElement;

async function open(host: MemoryHost) {
  render(<App host={host} />);
  fireEvent.click(await screen.findByRole("button", { name: "Abrir carpeta de sesión" }));
  await waitFor(() => expect(document.querySelectorAll(".line").length).toBeGreaterThan(0));
  // metadata arrives on the next tick
  await waitFor(() => expect(audio().readyState).toBeGreaterThan(0));
}

describe("opening a project", () => {
  it("shows the welcome screen, then the editor with project names and colors", async () => {
    const host = makeHost();
    await open(host);
    expect(screen.getAllByText("Lucía Prado", { selector: ".speaker" }).length).toBe(2);
    expect(document.querySelectorAll(".line")).toHaveLength(4);
    expect(screen.getAllByText("Entrevista de prueba").length).toBeGreaterThan(0);
    expect(line(0).querySelector<HTMLElement>(".speaker")?.style.color).toBe("rgb(127, 209, 255)");
    expect(line(0).querySelector<HTMLElement>(".text")?.style.color).toBe("rgb(127, 209, 255)");
    expect(audio().getAttribute("src")).toContain("memory://media/");
  });

  it("asks to create proyecto.json when it is missing and can continue without it", async () => {
    const files = sessionFiles();
    delete (files as Record<string, string | undefined>)["proyecto.json"];
    const host = makeHost(files);
    render(<App host={host} />);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir carpeta de sesión" }));
    expect(
      await screen.findByText("Esta sesión no tiene proyecto.json. ¿Querés crearlo?"),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continuar sin proyecto" }));
    await waitFor(() => expect(document.querySelectorAll(".line").length).toBe(4));
    expect(screen.getAllByText("Sin proyecto").length).toBeGreaterThan(0);
    // read-only project panel: lists labels and offers to create the file
    expect(screen.getByRole("button", { name: "Crear proyecto.json" })).toBeTruthy();
    expect(host.files.has("proyecto.json")).toBe(false);
  });

  it("Crear opens the mapping dialog and writes nothing until the first save", async () => {
    const files = sessionFiles();
    delete (files as Record<string, string | undefined>)["proyecto.json"];
    const host = makeHost(files);
    render(<App host={host} />);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir carpeta de sesión" }));
    fireEvent.click(await screen.findByRole("button", { name: "Crear" }));
    const dialog = await screen.findByRole("dialog", { name: "Archivos de la sesión" });
    expect((within(dialog).getByLabelText("Audio o video") as HTMLSelectElement).value).toBe(
      "demo.m4a",
    );
    expect((within(dialog).getByLabelText("Texto") as HTMLSelectElement).value).toBe("demo.txt");
    fireEvent.click(within(dialog).getByRole("button", { name: "Abrir sesión" }));
    await waitFor(() => expect(document.querySelectorAll(".line").length).toBe(4));
    expect(host.files.has("proyecto.json")).toBe(false);
    // the project dialog opens prefilled with the folder name and one row per speaker
    const proj = await screen.findByRole("dialog", { name: "Proyecto" });
    expect((within(proj).getByLabelText("Título") as HTMLInputElement).value).toBe("sesion-demo");
    expect(within(proj).getAllByRole("row")).toHaveLength(3);
    fireEvent.click(within(proj).getByRole("button", { name: "Cerrar" }));
    ctrl("KeyS", "s");
    await waitFor(() => expect(host.files.has("proyecto.json")).toBe(true));
    const saved = JSON.parse(host.files.get("proyecto.json")!.content);
    expect(saved.archivos).toMatchObject({ audio: "demo.m4a", texto: "demo.txt" });
    expect(saved.speakers).toHaveLength(2);
  });

  it("offers backup and recreate for a damaged proyecto.json", async () => {
    const host = makeHost(sessionFiles({ "proyecto.json": "{oops" }));
    render(<App host={host} />);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir carpeta de sesión" }));
    expect(await screen.findByText("proyecto.json está dañado")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ignorar y crear uno nuevo" }));
    expect(
      await screen.findByText("Esta sesión no tiene proyecto.json. ¿Querés crearlo?"),
    ).toBeTruthy();
    expect(host.files.get("proyecto.bak.json")?.content).toBe("{oops");
  });

  it("cancelling the native dialog stays on the welcome screen without errors", async () => {
    const host = makeHost();
    host.pickResult = "cancel";
    render(<App host={host} />);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir carpeta de sesión" }));
    await waitFor(() => expect(host.calls).toContain("project.pickFolder"));
    expect(screen.getByRole("button", { name: "Abrir carpeta de sesión" })).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows a friendly message when the folder is not allowed", async () => {
    const host = makeHost();
    host.pickResult = "error";
    render(<App host={host} />);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir carpeta de sesión" }));
    expect(await screen.findByText(/Esa carpeta no se puede abrir/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Abrir carpeta de sesión" })).toBeTruthy();
  });
});

describe("editing, estados and saving", () => {
  let host: MemoryHost;
  beforeEach(async () => {
    host = makeHost();
    await open(host);
  });

  it("edits a paragraph on blur and marks it corregido; empty edit restores the text", () => {
    const text = line(1).querySelector<HTMLElement>(".text")!;
    text.textContent = "Gracias por\nla invitación, Lucía.";
    fireEvent.blur(text);
    expect(line(1).className).toContain("est-corregido");
    expect(text.textContent).toBe("Gracias por la invitación, Lucía.");
    const other = line(2).querySelector<HTMLElement>(".text")!;
    other.textContent = "   ";
    fireEvent.blur(other);
    expect(other.textContent).toBe("Empecemos con la primera pregunta.");
    expect(line(2).className).toContain("est-pendiente");
  });

  it("Enter inside a paragraph blurs instead of adding a line break", () => {
    const text = line(0).querySelector<HTMLElement>(".text")!;
    text.focus();
    const ev = fireEvent.keyDown(text, { key: "Enter" });
    expect(ev).toBe(false); // preventDefault called
    expect(document.activeElement).not.toBe(text);
  });

  it("double click on the time cycles the estado", () => {
    const time = line(3).querySelector<HTMLElement>(".time")!;
    fireEvent.doubleClick(time);
    expect(line(3).className).toContain("est-leido");
    fireEvent.doubleClick(time);
    expect(line(3).className).toContain("est-corregido");
  });

  it("saves texto, meta and nothing else with Ctrl+S; paragraph count never changes", async () => {
    const text = line(1).querySelector<HTMLElement>(".text")!;
    text.textContent = "Texto corregido";
    fireEvent.blur(text);
    ctrl("KeyS", "s");
    await waitFor(() =>
      expect(host.files.get("demo.txt")?.content).toContain("SPEAKER_01: Texto corregido"),
    );
    const lines = host.files.get("demo.txt")!.content.split("\n").filter(Boolean);
    expect(lines).toHaveLength(4);
    const meta = JSON.parse(host.files.get("demo.meta.json")!.content);
    expect(meta).toHaveLength(4);
    expect(meta[1]).toMatchObject({ estado: "corregido", speaker: "SPEAKER_01", seconds: 10 });
    // proyecto.json was on disk and unchanged: not rewritten
    expect(host.calls.filter((c) => c === "project.writeText")).toHaveLength(2);
    expect((await screen.findAllByText(/Guardado ✓/)).length).toBeGreaterThan(0);
  });

  it("hotkeys read fresh state: edit, then Ctrl+Enter then save includes both", async () => {
    const text = line(0).querySelector<HTMLElement>(".text")!;
    text.textContent = "Primera frase editada";
    fireEvent.blur(text);
    audio().currentTime = 12; // paused: highlights paragraph 1 without touching estados
    await waitFor(() => expect(line(1).className).toContain("active"));
    expect(line(1).className).toContain("est-pendiente");
    ctrl("Enter", "Enter");
    expect(line(1).className).toContain("est-verificado");
    ctrl("KeyS", "s");
    await waitFor(() => expect(host.files.get("demo.meta.json")?.content).toContain("verificado"));
    expect(host.files.get("demo.txt")?.content).toContain("Primera frase editada");
  });

  it("Ctrl+Enter falls back to the paragraph at the playhead", () => {
    ctrl("Enter", "Enter");
    expect(line(0).className).toContain("est-verificado");
    expect(screen.getByText("Párrafo verificado ✓")).toBeTruthy();
  });

  it("ignores Ctrl+C and plain keys (they must reach the browser)", () => {
    const ok = fireEvent.keyDown(window, { code: "KeyC", key: "c", ctrlKey: true });
    expect(ok).toBe(true);
    expect(fireEvent.keyDown(window, { code: "Space", key: " " })).toBe(true);
  });

  it("shows a conflict dialog when the file changed on disk and can overwrite", async () => {
    const text = line(1).querySelector<HTMLElement>(".text")!;
    text.textContent = "Mi versión";
    fireEvent.blur(text);
    host.touch("demo.txt", "SPEAKER_00: externo\nSPEAKER_01: x\nSPEAKER_00: y\nSPEAKER_01: z\n");
    ctrl("KeyS", "s");
    const dialog = await screen.findByRole("dialog", { name: "El archivo cambió en el disco" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Sobrescribir" }));
    await waitFor(() => expect(host.files.get("demo.txt")?.content).toContain("Mi versión"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("asks before leaving with unsaved changes", async () => {
    const text = line(1).querySelector<HTMLElement>(".text")!;
    text.textContent = "Cambio";
    fireEvent.blur(text);
    fireEvent.click(screen.getByRole("button", { name: "Abrir carpeta…" }));
    const dialog = await screen.findByRole("dialog", { name: "Hay cambios sin guardar" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(host.calls.filter((c) => c === "project.pickFolder")).toHaveLength(1);
  });

  it("does not ask when nothing changed", () => {
    fireEvent.click(screen.getByRole("button", { name: "Abrir carpeta…" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("answers a close request: clean closes at once, dirty asks first", async () => {
    act(() => host.emitCloseRequested());
    await waitFor(() => expect(host.closeResponses).toEqual([true]));
    const text = line(1).querySelector<HTMLElement>(".text")!;
    text.textContent = "Cambio";
    fireEvent.blur(text);
    act(() => host.emitCloseRequested());
    const dialog = await screen.findByRole("dialog", { name: "Hay cambios sin guardar" });
    expect(host.calls).toContain("lifecycle.closeDialogOpen");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(host.closeResponses).toEqual([true, false]));
  });
});

describe("help, sidebar and widgets", () => {
  it("opens the Help modal with Ctrl and closes with Esc", async () => {
    const host = makeHost();
    await open(host);
    fireEvent.click(screen.getByRole("button", { name: "Ayuda: referencias y atajos" }));
    const dialog = await screen.findByRole("dialog", { name: "Ayuda" });
    expect(within(dialog).getAllByText("Ctrl").length).toBeGreaterThan(0);
    expect(within(dialog).queryByText("Cmd")).toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("shows Cmd on macOS", async () => {
    const host = makeHost(sessionFiles(), { platform: "darwin" });
    await open(host);
    fireEvent.click(screen.getByRole("button", { name: "Ayuda: referencias y atajos" }));
    const dialog = await screen.findByRole("dialog", { name: "Ayuda" });
    expect(within(dialog).getAllByText("Cmd").length).toBeGreaterThan(0);
  });

  it("switches language from Help and persists it", async () => {
    const host = makeHost();
    await open(host);
    fireEvent.click(screen.getByRole("button", { name: "Ayuda: referencias y atajos" }));
    const dialog = await screen.findByRole("dialog", { name: "Ayuda" });
    fireEvent.change(within(dialog).getByRole("combobox"), { target: { value: "en" } });
    expect(await screen.findByRole("dialog", { name: "Help" })).toBeTruthy();
    expect(host.settingsView().language).toBe("en");
  });

  it("renders the minimap (two lanes) and the stats with hand-computed numbers", async () => {
    const host = makeHost();
    await open(host);
    expect(document.querySelectorAll(".mapa-col")).toHaveLength(2);
    expect(document.querySelectorAll(".mapa-col")[0]!.querySelectorAll(".mapa-seg")).toHaveLength(
      4,
    );
    // proportional mode once the duration (120 s) is known: paragraph 1 spans 10..25 s
    const seg = document
      .querySelectorAll(".mapa-col")[0]!
      .querySelectorAll<HTMLElement>(".mapa-seg")[1]!;
    expect(parseFloat(seg.style.top)).toBeCloseTo((10 / 120) * 100, 5);
    const stats = screen.getByTestId("stats");
    const lucia = stats.querySelector('[data-habl="SPEAKER_00"]')!;
    // "Buenas tardes y bienvenida al programa." (6) + "Empecemos con la primera pregunta." (5) = 11
    expect(lucia.querySelector(".pal")?.textContent).toBe("11");
    const mateo = stats.querySelector('[data-habl="SPEAKER_01"]')!;
    // "Gracias por la invitación." (4) + "Claro, adelante." (2) = 6
    expect(mateo.querySelector(".pal")?.textContent).toBe("6");
    expect(stats.querySelector(".tot-pal")?.textContent).toBe("17");
  });

  it("clicking a minimap segment seeks and starts playback", async () => {
    const host = makeHost();
    await open(host);
    const seg = document
      .querySelectorAll(".mapa-col")[0]!
      .querySelectorAll<HTMLElement>(".mapa-seg")[2]!;
    fireEvent.click(seg);
    expect(audio().currentTime).toBe(25);
    expect(audio().paused).toBe(false);
  });

  it("toggles the sidebar and persists the setting", async () => {
    const host = makeHost();
    await open(host);
    fireEvent.click(screen.getByRole("button", { name: "Ocultar barra lateral" }));
    expect(document.querySelector("aside.sidebar")?.className).toContain("cerrada");
    expect(host.settingsView().sidebarCollapsed).toBe(true);
  });
});

describe("player", () => {
  let host: MemoryHost;
  beforeEach(async () => {
    host = makeHost();
    await open(host);
  });

  it("speed buttons set the rate, expose aria-pressed and the rate survives a src change", async () => {
    fireEvent.click(screen.getByRole("button", { name: "Velocidad 1.5 veces" }));
    expect(audio().playbackRate).toBe(1.5);
    expect(
      screen.getByRole("button", { name: "Velocidad 1.5 veces" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(host.settingsView().playbackRate).toBe(1.5);
    // new source: the browser resets the rate, our listeners must reapply it
    audio().src = "memory://media/other.m4a";
    await waitFor(() => expect(audio().readyState).toBeGreaterThan(0));
    expect(audio().playbackRate).toBe(1.5);
  });

  it("hotkeys change the speed and show a toast", () => {
    ctrl("Period", ".", { shiftKey: true });
    expect(audio().playbackRate).toBe(1.5);
    expect(screen.getByText("Velocidad x1.5")).toBeTruthy();
    ctrl("Comma", ",", { shiftKey: true });
    ctrl("Comma", ",", { shiftKey: true });
    expect(audio().playbackRate).toBe(0.75);
  });

  it("nudges 5 s without starting playback and toggles play", () => {
    ctrl("ArrowRight", "ArrowRight");
    expect(audio().currentTime).toBe(5);
    expect(audio().paused).toBe(true);
    expect(screen.getByText("Adelantar 5 s")).toBeTruthy();
    ctrl("Space", " ");
    expect(audio().paused).toBe(false);
    ctrl("Space", " ");
    expect(audio().paused).toBe(true);
    ctrl("ArrowLeft", "ArrowLeft");
    expect(audio().currentTime).toBe(0);
  });

  it("paragraph navigation while paused STARTS playback (prototype behavior)", async () => {
    audio().currentTime = 14;
    await waitFor(() => expect(line(1).className).toContain("active"));
    ctrl("ArrowUp", "ArrowUp");
    expect(audio().currentTime).toBe(10);
    expect(audio().paused).toBe(false);
    audio().pause();
    ctrl("ArrowDown", "ArrowDown");
    expect(audio().currentTime).toBe(25);
    expect(audio().paused).toBe(false);
  });

  it("start-of-paragraph jumps to the previous one when within 1.2 s of the start", async () => {
    audio().currentTime = 10.5;
    await waitFor(() => expect(line(1).className).toContain("active"));
    ctrl("ArrowUp", "ArrowUp");
    expect(audio().currentTime).toBe(0);
  });

  it("Home goes to the start of the audio without playing", () => {
    audio().currentTime = 30;
    ctrl("Home", "Home");
    expect(audio().currentTime).toBe(0);
    expect(audio().paused).toBe(true);
  });

  it("clicking a time seeks and plays", () => {
    fireEvent.click(line(2).querySelector(".time")!);
    expect(audio().currentTime).toBe(25);
    expect(audio().paused).toBe(false);
  });

  it("the seek slider moves the audio and is enabled once the duration is known", () => {
    const slider = screen.getByRole("slider", { name: "Posición del audio" }) as HTMLInputElement;
    expect(slider.disabled).toBe(false);
    fireEvent.change(slider, { target: { value: "42" } });
    expect(audio().currentTime).toBe(42);
    expect(audio().paused).toBe(true);
  });
});

describe("playback sync (rAF loop)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks leido once per paragraph change while playing and scrolls only on id change", async () => {
    const host = makeHost();
    render(<App host={host} />);
    await act(async () => {
      await vi.dynamicImportSettled?.();
    });
    fireEvent.click(await screen.findByRole("button", { name: "Abrir carpeta de sesión" }));
    await waitFor(() => expect(document.querySelectorAll(".line").length).toBe(4));
    await waitFor(() => expect(audio().readyState).toBeGreaterThan(0));
    const scroll = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
    scroll.mockClear();
    act(() => {
      void audio().play();
      audio().currentTime = 12;
    });
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(line(1).className).toContain("est-leido");
    expect(line(1).className).toContain("active");
    expect(line(0).className).toContain("est-pendiente");
    const calls = scroll.mock.calls.length;
    expect(calls).toBeGreaterThanOrEqual(1);
    // many more frames in the same paragraph: no new scrolls
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(scroll.mock.calls.length).toBe(calls);
    // a paused seek highlights but does not mark
    act(() => {
      audio().pause();
      audio().currentTime = 45;
    });
    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    expect(line(3).className).toContain("active");
    expect(line(3).className).toContain("est-pendiente");
  });
});

describe("raw transcripts and session memory", () => {
  const RAW = [
    "[00:00:02] SPEAKER_00: Hola a todos.",
    "",
    "[00:00:20] SPEAKER_01: Gracias.",
    "",
    "[00:00:41] SPEAKER_00: Seguimos.",
    "",
  ].join("\n");

  it("derives paragraphs from a raw file, never overwrites it, and creates the edited copy + project", async () => {
    const host = makeHost({ "sesion.m4a": "a", "sesion.txt": RAW });
    render(<App host={host} />);
    fireEvent.click(await screen.findByRole("button", { name: "Abrir carpeta de sesión" }));
    fireEvent.click(await screen.findByRole("button", { name: "Continuar sin proyecto" }));
    await waitFor(() => expect(document.querySelectorAll(".line").length).toBe(3));
    expect(line(1).querySelector(".time")?.textContent).toBe("00:20");
    const text = line(1).querySelector<HTMLElement>(".text")!;
    text.textContent = "Muchas gracias.";
    fireEvent.blur(text);
    ctrl("KeyS", "s");
    await waitFor(() => expect(host.files.has("sesion.editado.txt")).toBe(true));
    expect(host.files.get("sesion.txt")?.content).toBe(RAW);
    expect(host.files.get("sesion.editado.txt")?.content).toContain("SPEAKER_01: Muchas gracias.");
    expect(JSON.parse(host.files.get("sesion.meta.json")!.content)).toHaveLength(3);
    const pj = JSON.parse(host.files.get("proyecto.json")!.content);
    expect(pj.archivos).toEqual({
      audio: "sesion.m4a",
      texto: "sesion.editado.txt",
      meta: "sesion.meta.json",
      crudo: "sesion.txt",
    });
    expect((await screen.findAllByText(/se creó proyecto.json/)).length).toBeGreaterThan(0);
    // a second save goes to the edited file, not to a new editado-2
    fireEvent.blur(
      Object.assign(line(0).querySelector<HTMLElement>(".text")!, {
        textContent: "Hola de nuevo.",
      }),
    );
    ctrl("KeyS", "s");
    await waitFor(() =>
      expect(host.files.get("sesion.editado.txt")?.content).toContain("Hola de nuevo."),
    );
    expect(host.files.has("sesion.editado-2.txt")).toBe(false);
  });

  it("restores the last project, position and speed", async () => {
    const host = makeHost();
    const key = host.handle.projectKey;
    host.setSettings({
      lastProject: {
        key,
        path: host.handle.displayPath,
        name: "sesion-demo",
        lastOpenedAt: "2025-01-01T00:00:00.000Z",
      },
      recentProjects: [
        {
          key,
          path: host.handle.displayPath,
          name: "sesion-demo",
          lastOpenedAt: "2025-01-01T00:00:00.000Z",
        },
      ],
    });
    host.sessions.set(key, {
      path: host.handle.displayPath,
      lastOpenedAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
      audioName: "demo.m4a",
      positionSec: 27,
      activeParagraphId: 2,
      playbackRate: 1.5,
    });
    render(<App host={host} />);
    await waitFor(() => expect(document.querySelectorAll(".line").length).toBe(4));
    await waitFor(() => expect(audio().currentTime).toBe(27));
    expect(audio().playbackRate).toBe(1.5);
    expect(audio().paused).toBe(true);
    expect(line(2).className).toContain("active");
  });

  it("ignores a saved position for a different audio file", async () => {
    const host = makeHost();
    const key = host.handle.projectKey;
    const entry = {
      key,
      path: host.handle.displayPath,
      name: "sesion-demo",
      lastOpenedAt: "2025-01-01T00:00:00.000Z",
    };
    host.setSettings({ lastProject: entry, recentProjects: [entry] });
    host.sessions.set(key, {
      path: "x",
      lastOpenedAt: entry.lastOpenedAt,
      updatedAt: entry.lastOpenedAt,
      audioName: "otro.mp4",
      positionSec: 50,
      activeParagraphId: 1,
    });
    render(<App host={host} />);
    await waitFor(() => expect(document.querySelectorAll(".line").length).toBe(4));
    await waitFor(() => expect(audio().readyState).toBeGreaterThan(0));
    expect(audio().currentTime).toBe(0);
  });

  it("removes a vanished last project from recents and tells the user", async () => {
    const host = makeHost();
    host.setSettings({
      lastProject: {
        key: "c".repeat(32),
        path: "/gone",
        name: "gone",
        lastOpenedAt: "2025-01-01T00:00:00.000Z",
      },
      recentProjects: [
        {
          key: "c".repeat(32),
          path: "/gone",
          name: "gone",
          lastOpenedAt: "2025-01-01T00:00:00.000Z",
        },
      ],
    });
    render(<App host={host} />);
    expect(await screen.findByText("No se encontró la última carpeta")).toBeTruthy();
    await waitFor(() => expect(host.settingsView().recentProjects).toHaveLength(0));
  });

  it("tells the user when the settings file was recovered", async () => {
    const host = makeHost();
    host.setSettings({ recovered: true });
    render(<App host={host} />);
    expect(await screen.findByText(/La configuración estaba dañada/)).toBeTruthy();
  });

  it("saves the session position when pausing", async () => {
    const host = makeHost();
    await open(host);
    act(() => {
      audio().currentTime = 33;
      audio().pause();
    });
    await waitFor(() => expect(host.savedSessions.length).toBeGreaterThan(0));
    const last = host.savedSessions.at(-1)!;
    expect(last.state).toMatchObject({ audioName: "demo.m4a", positionSec: 33 });
  });
});

describe("misc", () => {
  it("shows a toast when there is no paragraph at the playhead", async () => {
    const meta = JSON.stringify(
      [5, 15, 25, 35].map((seconds) => ({ seconds, speaker: "SPEAKER_00", estado: "pendiente" })),
    );
    const host = makeHost(sessionFiles({ "demo.meta.json": meta }));
    await open(host);
    ctrl("Enter", "Enter");
    expect(screen.getByText("No hay párrafo activo")).toBeTruthy();
  });

  it("warns about missing times and invalid meta", async () => {
    const host = makeHost(sessionFiles({ "demo.meta.json": "{oops" }));
    await open(host);
    expect(screen.getByText(/no es un JSON válido/)).toBeTruthy();
    expect(screen.getByText(/Sin tiempos/)).toBeTruthy();
  });

  it("uses the fixture text unchanged", () => {
    expect(TEXT.split("\n").filter(Boolean)).toHaveLength(4);
  });
});
