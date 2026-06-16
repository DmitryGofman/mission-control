const { app, BrowserWindow, ipcMain, Menu, shell, dialog } = require("electron");
const fs = require("fs");
const path = require("path");
const store = require("./store");
const { exportXlsx } = require("./excel");

// Where the SQLite file lives: next to the (portable) executable when packaged,
// so it sits "in the folder the app operates in"; the project folder in dev.
function baseDir() {
  if (process.env.PORTABLE_EXECUTABLE_DIR) return process.env.PORTABLE_EXECUTABLE_DIR;
  if (app.isPackaged) return path.dirname(app.getPath("exe"));
  return __dirname;
}

const today = () => new Date().toISOString().slice(0, 10);
const read = (key) => { try { return JSON.parse(store.getItem(key) || "[]"); } catch { return []; } };

async function exportExcel(win) {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: "ייצוא ל-Excel",
    defaultPath: `מרכז-משימות-${today()}.xlsx`,
    filters: [{ name: "Excel", extensions: ["xlsx"] }],
  });
  if (canceled || !filePath) return;
  await exportXlsx(filePath, { tasks: read("mc:tasks:v2"), procurement: read("mc:procurement:v2") });
  shell.showItemInFolder(filePath);
}

async function exportBackup(win) {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: "ייצוא גיבוי (JSON)",
    defaultPath: `mission-control-backup-${today()}.json`,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (canceled || !filePath) return;
  const data = {
    tasks: read("mc:tasks:v2"), members: read("mc:members:v2"),
    proc: read("mc:procurement:v2"), log: read("mc:auditlog:v2"),
    exportedAt: new Date().toISOString(),
  };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  shell.showItemInFolder(filePath);
}

function buildMenu(win) {
  const template = [
    {
      label: "קובץ",
      submenu: [
        { label: "ייצוא ל-Excel…", accelerator: "CmdOrCtrl+E", click: () => exportExcel(win) },
        { label: "ייצוא גיבוי (JSON)…", click: () => exportBackup(win) },
        { type: "separator" },
        { label: "פתח תיקיית נתונים", click: () => shell.showItemInFolder(store.getDbPath()) },
        { type: "separator" },
        { role: "quit", label: "יציאה" },
      ],
    },
    {
      label: "עריכה",
      submenu: [
        { role: "undo", label: "בטל" },
        { role: "redo", label: "בצע שוב" },
        { type: "separator" },
        { role: "cut", label: "גזור" },
        { role: "copy", label: "העתק" },
        { role: "paste", label: "הדבק" },
        { role: "selectAll", label: "בחר הכל" },
      ],
    },
    {
      label: "תצוגה",
      submenu: [
        { role: "reload", label: "רענן" },
        { role: "resetZoom", label: "איפוס זום" },
        { role: "zoomIn", label: "הגדל" },
        { role: "zoomOut", label: "הקטן" },
        { type: "separator" },
        { role: "togglefullscreen", label: "מסך מלא" },
        { role: "toggleDevTools", label: "כלי פיתוח" },
      ],
    },
    {
      label: "עזרה",
      submenu: [
        { label: "אתר הפרויקט", click: () => shell.openExternal("https://dmitrygofman.github.io/mission-control/") },
        {
          label: "אודות",
          click: () => dialog.showMessageBox(win, {
            type: "info", title: "אודות",
            message: "מרכז בקרת משימות",
            detail: `גרסה ${app.getVersion()}\nהנתונים נשמרים מקומית בקובץ:\n${store.getDbPath()}`,
          }),
        },
      ],
    },
  ];
  return Menu.buildFromTemplate(template);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: "#0B0E14",
    title: "מרכז בקרת משימות",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  Menu.setApplicationMenu(buildMenu(win));
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
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

  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => {
  try { store.persist(); } catch {}
  if (process.platform !== "darwin") app.quit();
});
