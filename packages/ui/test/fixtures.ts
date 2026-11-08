import { createMemoryHost, type MemoryHost } from "@transcript-editor/storage/testing";

// Invented session: two speakers, four paragraphs.
export const TEXT =
  [
    "SPEAKER_00: Buenas tardes y bienvenida al programa.",
    "SPEAKER_01: Gracias por la invitación.",
    "SPEAKER_00: Empecemos con la primera pregunta.",
    "SPEAKER_01: Claro, adelante.",
  ].join("\n") + "\n";

export const META = JSON.stringify(
  [
    { seconds: 0, speaker: "SPEAKER_00", estado: "pendiente" },
    { seconds: 10, speaker: "SPEAKER_01", estado: "pendiente" },
    { seconds: 25, speaker: "SPEAKER_00", estado: "pendiente" },
    { seconds: 40, speaker: "SPEAKER_01", estado: "pendiente" },
  ],
  null,
  2,
);

export const PROJECT = JSON.stringify(
  {
    version: 1,
    titulo: "Entrevista de prueba",
    descripcion: "Sesión inventada",
    archivos: { audio: "demo.m4a", texto: "demo.txt", meta: "demo.meta.json" },
    speakers: [
      { id: "SPEAKER_00", nombre: "Lucía Prado", iniciales: "LP", color: "#7fd1ff" },
      { id: "SPEAKER_01", nombre: "Mateo Rey", iniciales: "MR", color: "#ffc47f" },
    ],
    visualizacion: { mostrar: "nombre", colorearTexto: true },
  },
  null,
  2,
);

export function sessionFiles(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "demo.m4a": "audio-bytes",
    "demo.txt": TEXT,
    "demo.meta.json": META,
    "proyecto.json": PROJECT,
    ...extra,
  };
}

export function makeHost(files: Record<string, string> = sessionFiles(), opts = {}): MemoryHost {
  return createMemoryHost(files, opts);
}
