import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

// Build config for the Electron desktop app: relative base (loaded via file://)
// and output into desktop/renderer. The React UI is identical to the web app —
// only the persistence layer differs (SQLite via window.mcStore, see storage.js).
//
// The desktop build also strips the mobile/PWA-only assets (service worker, web
// manifest, app icons) so the package is lighter and has nothing that misbehaves
// under file://. The Hebrew fonts are kept (needed offline).
function stripPwa() {
  const outDir = "desktop/renderer";
  return {
    name: "strip-pwa-for-desktop",
    transformIndexHtml(html) {
      return html
        .replace(/\s*<link rel="manifest"[^>]*>/g, "")
        .replace(/\s*<meta name="theme-color"[^>]*>/g, "")
        .replace(/\s*<meta name="apple-[^>]*>/g, "")
        .replace(/\s*<link rel="apple-touch-icon"[^>]*>/g, "")
        .replace(/\s*<link rel="icon"[^>]*>/g, "")
        .replace(/\s*<!-- PWA \/ installable -->/g, "")
        .replace(/\s*<!-- iOS: Add to Home Screen -->/g, "");
    },
    closeBundle() {
      // CRITICAL: strip `crossorigin` from the injected <script>/<link> tags.
      // The desktop app loads index.html via file://, where a crossorigin
      // (CORS) module request is blocked by Chromium ("origin 'null'") — the
      // bundle never executes and the window stays blank white. Removing the
      // attribute makes it a plain same-origin file:// load, which Electron allows.
      try {
        const idx = path.join(outDir, "index.html");
        let html = fs.readFileSync(idx, "utf8");
        html = html.replace(/\s+crossorigin(=["'][^"']*["'])?/g, "");
        fs.writeFileSync(idx, html);
      } catch (e) { console.warn("could not strip crossorigin:", e.message); }
      for (const f of ["sw.js", "manifest.webmanifest"]) {
        try { fs.rmSync(path.join(outDir, f)); } catch {}
      }
      try { fs.rmSync(path.join(outDir, "icons"), { recursive: true, force: true }); } catch {}
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), stripPwa()],
  build: { outDir: "desktop/renderer", emptyOutDir: true },
});
