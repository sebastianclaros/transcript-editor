// Ambient declarations for the Vite-bundled UI (the package keeps `types: []`).
declare module "*.css";

interface ImportMeta {
  readonly env?: { readonly DEV?: boolean; readonly MODE?: string };
}
