import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Build config for the Electron desktop app: relative base (loaded via file://)
// and output into desktop/renderer. The React UI is identical to the web app —
// only the persistence layer differs (SQLite via window.mcStore, see storage.js).
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { outDir: "desktop/renderer", emptyOutDir: true },
});
