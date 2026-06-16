const { app, BrowserWindow, ipcMain, Menu, shell } = require("electron");
const path = require("path");
const store = require("./store");

// Where the SQLite file lives: next to the (portable) executable when packaged,
// so it sits "in the folder the app operates in"; the project folder in dev.
function baseDir() {
  if (process.env.PORTABLE_EXECUTABLE_DIR) return process.env.PORTABLE_EXECUTABLE_DIR;
  if (app.isPackaged) return path.dirname(app.getPath("exe"));
  return __dirname;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: "#0B0E14",
    title: "מרכז בקרת משימות",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  // Open external links (if any) in the system browser, not the app window.
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
}

app.whenReady().then(async () => {
  await store.init(path.join(baseDir(), "mission-control.db"));

  // Synchronous key/value (mirrors localStorage) + async blob ops (attachments).
  ipcMain.on("mc:getItem", (e, key) => { e.returnValue = store.getItem(key); });
  ipcMain.on("mc:setItem", (e, key, json) => { store.setItem(key, json); e.returnValue = true; });
  ipcMain.on("mc:dbPath", (e) => { e.returnValue = store.getDbPath(); });
  ipcMain.handle("mc:putBlob", (e, id, bytes, type) => { store.putBlob(id, bytes, type); return true; });
  ipcMain.handle("mc:getBlob", (e, id) => store.getBlob(id));
  ipcMain.handle("mc:deleteBlob", (e, id) => { store.deleteBlob(id); return true; });

  Menu.setApplicationMenu(null);
  createWindow();

  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => {
  try { store.persist(); } catch {}
  if (process.platform !== "darwin") app.quit();
});
