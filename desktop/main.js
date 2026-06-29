const { app, BrowserWindow, ipcMain, Menu, shell, dialog, session } = require("electron");
const fs = require("fs");
const path = require("path");
const store = require("./store");
const { exportXlsx, importXlsx, templateXlsx } = require("./excel");

// Load the UI in a dedicated session partition. Older builds accidentally
// registered a service worker under the default file:// session that hijacked
// page loads (black screen). A fresh partition can never inherit that SW, and
// our data lives in SQLite (not the session), so nothing is lost.
const PARTITION = "persist:mc";

const KEYS = { tasks: "mc:tasks:v2", members: "mc:members:v2", proc: "mc:procurement:v2", log: "mc:auditlog:v2", asm: "mc:assemblies:v1", project: "mc:project:v1" };
const ASM_PALETTE = ["#E8B84B", "#58A6FF", "#3FB950", "#F778BA", "#BC8CFF", "#F0883E", "#56D4DD", "#DB6D28", "#A5D6A7", "#FF7B72"];

let linkedXlsx = null;
let xlsxTimer = null;

// Where the SQLite file lives: next to the (portable) executable when packaged,
// so it sits "in the folder the app operates in"; the project folder in dev.
function baseDir() {
  if (process.env.PORTABLE_EXECUTABLE_DIR) return process.env.PORTABLE_EXECUTABLE_DIR;
  if (app.isPackaged) return path.dirname(app.getPath("exe"));
  return __dirname;
}

const today = () => new Date().toISOString().slice(0, 10);
const readArr = (key) => { try { return JSON.parse(store.getItem(key) || "[]"); } catch { return []; } };
const readObj = (key) => { try { return JSON.parse(store.getItem(key) || "{}"); } catch { return {}; } };
const readStr = (key) => { try { const v = JSON.parse(store.getItem(key) || '""'); return typeof v === "string" ? v : ""; } catch { return ""; } };

// ---------- linked Excel auto-sync ----------
function syncLinkedExcel() {
  if (!linkedXlsx) return Promise.resolve();
  return exportXlsx(linkedXlsx, { tasks: readArr(KEYS.tasks), procurement: readArr(KEYS.proc), projectName: readStr(KEYS.project) })
    .catch((e) => console.error("excel sync failed:", e.message));
}
function scheduleXlsxSync() {
  if (!linkedXlsx) return;
  clearTimeout(xlsxTimer);
  xlsxTimer = setTimeout(syncLinkedExcel, 800);
}

// ---------- exports ----------
async function exportExcel(win) {
  const pname = readStr(KEYS.project);
  const safe = (pname || "מרכז-משימות").trim().replace(/[\\/:*?"<>|]/g, "-");
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: "ייצוא ל-Excel", defaultPath: `${safe}-${today()}.xlsx`,
    filters: [{ name: "Excel", extensions: ["xlsx"] }],
  });
  if (canceled || !filePath) return;
  await exportXlsx(filePath, { tasks: readArr(KEYS.tasks), procurement: readArr(KEYS.proc), projectName: pname });
  shell.showItemInFolder(filePath);
}

async function exportBackup(win) {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: "ייצוא גיבוי (JSON)", defaultPath: `mission-control-backup-${today()}.json`,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (canceled || !filePath) return;
  const data = {
    v: 2,
    tasks: readArr(KEYS.tasks), members: readArr(KEYS.members), proc: readArr(KEYS.proc), log: readArr(KEYS.log),
    assemblies: readObj(KEYS.asm), projectName: readStr(KEYS.project),
    exportedAt: new Date().toISOString(),
  };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  shell.showItemInFolder(filePath);
}

async function downloadTemplate(win) {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: "הורד תבנית Excel", defaultPath: `תבנית-מרכז-משימות.xlsx`,
    filters: [{ name: "Excel", extensions: ["xlsx"] }],
  });
  if (canceled || !filePath) return;
  await templateXlsx(filePath, { assemblies: Object.keys(readObj(KEYS.asm)), members: readArr(KEYS.members).map((m) => m.name) });
  shell.showItemInFolder(filePath);
}

// ---------- import ----------
function applyImport(data, replace) {
  const existingTasks = replace ? [] : readArr(KEYS.tasks);
  let tid = Math.max(0, ...existingTasks.map((t) => t.id || 0)) + 1;
  const newTasks = data.tasks.map((t) => ({
    id: tid++, asm: t.asm || "", task: t.task, pri: t.pri, status: t.status,
    who: t.who || "", ctrl: t.ctrl || "", due: t.due || "", notes: t.notes || "",
    tags: t.tags || [], checklist: [], comments: [], attachments: [],
  }));
  store.setItem(KEYS.tasks, JSON.stringify([...existingTasks, ...newTasks]));

  const existingProc = replace ? [] : readArr(KEYS.proc);
  let pid = Math.max(0, ...existingProc.map((p) => p.id || 0)) + 1;
  const newProc = data.procurement.map((p) => ({ id: pid++, ...p }));
  store.setItem(KEYS.proc, JSON.stringify([...existingProc, ...newProc]));

  // Merge any new מכלול values into the managed list (assign colors).
  const asmObj = readObj(KEYS.asm);
  for (const t of newTasks) {
    const a = (t.asm || "").trim();
    if (a && !asmObj[a]) asmObj[a] = ASM_PALETTE[Object.keys(asmObj).length % ASM_PALETTE.length];
  }
  store.setItem(KEYS.asm, JSON.stringify(asmObj));

  // Add any new people from the מבצע/בקר columns to the team list.
  const membersArr = readArr(KEYS.members);
  const haveNames = new Set(membersArr.map((m) => m.name));
  for (const t of newTasks) {
    for (const name of [t.who, t.ctrl]) {
      const n = (name || "").trim();
      if (n && !haveNames.has(n)) {
        haveNames.add(n);
        membersArr.push({ id: "m_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: n, color: ASM_PALETTE[membersArr.length % ASM_PALETTE.length], isController: false });
      }
    }
  }
  store.setItem(KEYS.members, JSON.stringify(membersArr));

  const log = readArr(KEYS.log);
  log.unshift({ ts: new Date().toISOString(), action: replace ? "יובא מ-Excel (החלפה)" : "יובא מ-Excel (הוספה)", detail: `${newTasks.length} משימות · ${newProc.length} רכש` });
  store.setItem(KEYS.log, JSON.stringify(log.slice(0, 500)));

  syncLinkedExcel();
}

async function importExcel(win) {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: "ייבוא מ-Excel", properties: ["openFile"], filters: [{ name: "Excel", extensions: ["xlsx"] }],
  });
  if (canceled || !filePaths || !filePaths[0]) return;
  let data;
  try { data = await importXlsx(filePaths[0]); }
  catch (e) { dialog.showErrorBox("הייבוא נכשל", "לא ניתן לקרוא את הקובץ:\n" + e.message); return; }

  if (!data.tasks.length && !data.procurement.length) {
    dialog.showMessageBox(win, { type: "warning", message: "לא נמצאו שורות לייבוא", detail: 'ודאו שהקובץ תואם לתבנית (גיליון "משימות" עם עמודות מכלול/משימה/סטטוס...).' });
    return;
  }
  const { response } = await dialog.showMessageBox(win, {
    type: "question", buttons: ["החלף הכל", "הוסף לקיים", "ביטול"], defaultId: 0, cancelId: 2,
    message: `לייבא ${data.tasks.length} משימות ו-${data.procurement.length} פריטי רכש?`,
    detail: '"החלף הכל" ימחק את הנתונים הקיימים ויטען מחדש מהאקסל.\n"הוסף לקיים" יוסיף את השורות לקיימות.',
  });
  if (response === 2) return;
  applyImport(data, response === 0);
  win.webContents.reload();
}

// ---------- linked Excel menu ----------
async function linkExcel(win) {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: "ייצוא חי לאקסל (חד-כיווני)",
    defaultPath: linkedXlsx || `מרכז-משימות-חי.xlsx`,
    filters: [{ name: "Excel", extensions: ["xlsx"] }],
  });
  if (canceled || !filePath) return;
  linkedXlsx = filePath;
  store.setConfig("linkedXlsx", filePath);
  await syncLinkedExcel();
  rebuildMenu(win);
  dialog.showMessageBox(win, {
    type: "info", message: "ייצוא חי לאקסל הופעל",
    detail: `הקובץ ייכתב מחדש אוטומטית אחרי כל שינוי באפליקציה:\n${filePath}\n\n⚠ חד-כיווני בלבד: עריכות שתבצעו ישירות בקובץ ה-Excel ידרסו בשינוי הבא. לעריכה — השתמשו באפליקציה, או בייבוא מ-Excel.`,
  });
}
function unlinkExcel(win) {
  linkedXlsx = null;
  store.setConfig("linkedXlsx", null);
  rebuildMenu(win);
}

function rebuildMenu(win) { Menu.setApplicationMenu(buildMenu(win)); }

function buildMenu(win) {
  const template = [
    {
      label: "קובץ",
      submenu: [
        { label: "ייבוא מ-Excel…", click: () => importExcel(win) },
        { label: "הורד תבנית Excel…", click: () => downloadTemplate(win) },
        { type: "separator" },
        { label: "ייצוא ל-Excel…", accelerator: "CmdOrCtrl+E", click: () => exportExcel(win) },
        { label: "ייצוא גיבוי (JSON)…", click: () => exportBackup(win) },
        { type: "separator" },
        linkedXlsx
          ? { label: `נתק ייצוא חי לאקסל  (${path.basename(linkedXlsx)})`, click: () => unlinkExcel(win) }
          : { label: "ייצוא חי לאקסל (חד-כיווני)…", click: () => linkExcel(win) },
        { type: "separator" },
        { label: "פתח תיקיית נתונים", click: () => shell.showItemInFolder(store.getDbPath()) },
        { label: "פתח תיקיית קבצים מצורפים", click: () => shell.openPath(store.getAttachDir()) },
        { type: "separator" },
        { role: "quit", label: "יציאה" },
      ],
    },
    {
      label: "עריכה",
      submenu: [
        // registerAccelerator:false keeps the Ctrl+Z/Ctrl+Y shortcut visible in the
        // menu but lets it pass through to the page, so the app's own Undo (restore
        // deleted task / revert change) works. Text fields still get native undo
        // from Chromium directly.
        { role: "undo", label: "בטל", registerAccelerator: false },
        { role: "redo", label: "בצע שוב", registerAccelerator: false },
        { type: "separator" },
        { role: "cut", label: "גזור" }, { role: "copy", label: "העתק" },
        { role: "paste", label: "הדבק" }, { role: "selectAll", label: "בחר הכל" },
      ],
    },
    {
      label: "תצוגה",
      submenu: [
        { role: "reload", label: "רענן" },
        { role: "resetZoom", label: "איפוס זום" }, { role: "zoomIn", label: "הגדל" }, { role: "zoomOut", label: "הקטן" },
        { type: "separator" },
        { role: "togglefullscreen", label: "מסך מלא" }, { role: "toggleDevTools", label: "כלי פיתוח" },
      ],
    },
    {
      label: "עזרה",
      submenu: [
        { label: "אתר הפרויקט", click: () => shell.openExternal("https://dmitrygofman.github.io/mission-control/") },
        {
          label: "אודות",
          click: () => dialog.showMessageBox(win, {
            type: "info", title: "אודות", message: "מרכז בקרת משימות",
            detail: `גרסה ${app.getVersion()}\nנתונים: ${store.getDbPath()}\nExcel מקושר: ${linkedXlsx || "—"}`,
          }),
        },
      ],
    },
  ];
  return Menu.buildFromTemplate(template);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1320, height: 860, minWidth: 940, minHeight: 600,
    backgroundColor: "#0B0E14", title: "מרכז בקרת משימות",
    icon: path.join(__dirname, "build", "icon.ico"),
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, partition: PARTITION },
  });
  Menu.setApplicationMenu(buildMenu(win));
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
}

app.whenReady().then(async () => {
  await store.init(path.join(baseDir(), "mission-control.db"));
  linkedXlsx = store.getConfig("linkedXlsx") || null;

  // Wipe any service worker / cache left by an earlier build, from BOTH the old
  // default session and our partition. (Data is in SQLite, never touched.)
  for (const ses of [session.defaultSession, session.fromPartition(PARTITION)]) {
    try { await ses.clearStorageData({ storages: ["serviceworkers", "cachestorage"] }); } catch {}
  }

  ipcMain.on("mc:getItem", (e, key) => { e.returnValue = store.getItem(key); });
  ipcMain.on("mc:setItem", (e, key, json) => {
    store.setItem(key, json);
    e.returnValue = true;
    if (key.includes("tasks") || key.includes("procurement")) scheduleXlsxSync();
  });
  ipcMain.on("mc:dbPath", (e) => { e.returnValue = store.getDbPath(); });
  ipcMain.handle("mc:putBlob", (e, id, bytes, type, name) => { store.putBlob(id, bytes, type, name); return true; });
  ipcMain.handle("mc:getBlob", (e, id) => store.getBlob(id));
  ipcMain.handle("mc:deleteBlob", (e, id) => { store.deleteBlob(id); return true; });
  ipcMain.handle("mc:openAttachment", async (e, id) => { const p = store.getAttachmentPath(id); if (p) await shell.openPath(p); return !!p; });
  ipcMain.handle("mc:revealAttachment", (e, id) => { const p = store.getAttachmentPath(id); if (p) shell.showItemInFolder(p); return !!p; });

  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => {
  try { store.persist(); } catch {}
  if (process.platform !== "darwin") app.quit();
});
