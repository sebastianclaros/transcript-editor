import { defineConfig } from "vitest/config";

// Root Vitest config. Each workspace is a "project" so that environments differ
// (core/storage/main run in node, ui runs in jsdom). Coverage thresholds are enforced
// for packages/core only (see docs/development.md).
export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: "core",
          environment: "node",
          include: ["packages/core/test/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "storage",
          environment: "node",
          include: ["packages/storage/test/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["packages/ui/test/**/*.test.{ts,tsx}"],
          setupFiles: ["packages/ui/test/setup.ts"],
        },
      },
      {
        test: {
          name: "desktop",
          environment: "node",
          include: ["apps/desktop/src/**/*.test.ts", "apps/desktop/test/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "scripts",
          environment: "node",
          include: ["scripts/**/*.test.mjs"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["packages/core/src/**/*.ts"],
      exclude: ["packages/core/src/**/index.ts"],
      reporter: ["text-summary"],
      thresholds: { lines: 90, branches: 85 },
    },
  },
});
