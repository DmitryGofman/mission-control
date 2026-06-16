import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// On GitHub Pages the app is served from /<repo>/, so set the base for
// production builds. Dev/preview keep "/". Override with BASE_PATH if needed.
const base = process.env.BASE_PATH ?? (process.env.NODE_ENV === "production" ? "/mission-control/" : "/");

export default defineConfig({
  base,
  plugins: [react()],
});
