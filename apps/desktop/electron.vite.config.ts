import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

// Both main and preload are emitted as CommonJS (`.cjs`): sandboxed preloads cannot be ESM and a
// CJS main keeps __dirname and the CJS-only electron-updater import working. See ADR 0002.
const cjs = { output: { format: "cjs" as const, entryFileNames: "[name].cjs" } };
const bundled = ["zod", "@transcript-editor/core", "@transcript-editor/storage"];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: bundled })],
    build: {
      rollupOptions: { input: { index: resolve(__dirname, "src/main/index.ts") }, ...cjs },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: bundled })],
    build: {
      rollupOptions: { input: { index: resolve(__dirname, "src/preload/index.ts") }, ...cjs },
    },
  },
  renderer: {
    root: resolve(__dirname, "src/renderer"),
    plugins: [react()],
    build: {
      rollupOptions: { input: { index: resolve(__dirname, "src/renderer/index.html") } },
    },
  },
});
