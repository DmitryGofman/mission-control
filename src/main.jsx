import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Service worker is for the WEB PWA only. In the desktop app (Electron, file://)
// a SW hijacks navigations and breaks loading — so never register it there, and
// proactively unregister any left over from an earlier build.
const isDesktop = typeof window !== "undefined" && !!window.mcStore;
if (isDesktop) {
  document.querySelector('link[rel="manifest"]')?.remove();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations?.()
      .then((rs) => rs.forEach((r) => r.unregister()))
      .catch(() => {});
  }
} else if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
