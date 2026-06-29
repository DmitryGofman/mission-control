const { contextBridge, ipcRenderer } = require("electron");

// Exposed to the renderer as window.mcStore. storage.js detects this and routes
// persistence to SQLite (instead of localStorage/IndexedDB) when running in the
// desktop app. Key/value is synchronous to match the web loadJSON/saveJSON API.
contextBridge.exposeInMainWorld("mcStore", {
  getItemSync: (k) => ipcRenderer.sendSync("mc:getItem", k),
  setItemSync: (k, v) => ipcRenderer.sendSync("mc:setItem", k, v),
  dbPath: () => ipcRenderer.sendSync("mc:dbPath"),
  putBlob: (id, bytes, type, name) => ipcRenderer.invoke("mc:putBlob", id, bytes, type, name),
  getBlob: (id) => ipcRenderer.invoke("mc:getBlob", id),
  deleteBlob: (id) => ipcRenderer.invoke("mc:deleteBlob", id),
  openBlob: (id) => ipcRenderer.invoke("mc:openAttachment", id),
  revealBlob: (id) => ipcRenderer.invoke("mc:revealAttachment", id),
  // Shared-Excel live sync: main pushes merged data / a "busy" signal.
  onDataChanged: (cb) => ipcRenderer.on("mc:dataChanged", (e, data) => cb(data)),
  onSyncBusy: (cb) => ipcRenderer.on("mc:syncBusy", () => cb()),
});
