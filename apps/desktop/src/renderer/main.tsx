import { createRoot } from "react-dom/client";
import type { HostApi } from "@transcript-editor/storage";
import { App } from "@transcript-editor/ui";

declare global {
  interface Window {
    host: HostApi;
  }
}

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");
createRoot(root).render(<App host={window.host} />);
