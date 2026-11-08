import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";

// Boundary rules (design 1.1 / 1.3). Second layer: scripts/check-boundaries.mjs.
const nodeBuiltins = ["node:*", "fs", "fs/*", "path", "os", "child_process", "crypto", "url"];
const forbiddenGlobalsUi = ["process", "require", "__dirname", "__filename"].map((name) => ({
  name,
  message: "Not allowed in this package (see docs/architecture.md).",
}));
const domGlobals = ["window", "document", "localStorage", "sessionStorage", "fetch", "process"].map(
  (name) => ({ name, message: "packages/core and packages/storage must be DOM/Node free." }),
);

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/out/**",
      "**/coverage/**",
      ".agents/**",
      "samples/**",
      "tools/**",
      "apps/desktop/e2e/artifacts/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.es2022 } },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["packages/core/**/*.ts", "packages/storage/**/*.ts"],
    ignores: ["**/test/**"],
    languageOptions: { globals: {} },
    rules: {
      "no-restricted-globals": ["error", ...domGlobals],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "react*",
            "electron*",
            ...nodeBuiltins,
            "@transcript-editor/ui",
            "@transcript-editor/desktop",
          ],
        },
      ],
    },
  },
  {
    files: ["packages/core/**/*.ts"],
    ignores: ["**/test/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "react*",
            "electron*",
            ...nodeBuiltins,
            "@transcript-editor/ui",
            "@transcript-editor/storage",
            "@transcript-editor/desktop",
          ],
        },
      ],
    },
  },
  {
    files: ["packages/ui/**/*.{ts,tsx}"],
    ignores: ["**/test/**"],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      "no-restricted-globals": [
        "error",
        ...forbiddenGlobalsUi,
        { name: "fetch", message: "Use HostApi." },
      ],
      "no-restricted-imports": ["error", { patterns: ["electron*", ...nodeBuiltins] }],
    },
  },
  {
    files: ["packages/ui/test/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ["apps/desktop/src/renderer/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      "no-restricted-imports": ["error", { patterns: ["electron", "electron/*", ...nodeBuiltins] }],
    },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: { sourceType: "commonjs" },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
);
