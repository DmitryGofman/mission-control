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
let applyingExternal = false; // true while importing an external Excel edit (suppresses our writes)
let lastSyncMtime = 0;        // mtime of the file after OUR last write, to ignore our own changes
let watchedPath = null;       // the file currently being watched

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

// ---------- linked Excel: two-way sync ----------
// App → Excel (write) on every change, AND Excel → App (read) when the file is
// edited externally. Matched by the מזהה (ID) column so external edits update
// the right task while app-only data (checklists/comments/attachments) is kept.
function syncLinkedExcel() {
  if (!linkedXlsx || applyingExternal) return Promise.resolve();
  return exportXlsx(linkedXlsx, { tasks: readArr(KEYS.tasks), procurement: readArr(KEYS.proc), projectName: readStr(KEYS.project) })
    .then(() => { try { lastSyncMtime = fs.statSync(linkedXlsx).mtimeMs; } catch {} })
    .catch((e) => console.error("excel sync failed:", e.message));
}
function scheduleXlsxSync() {
  if (!linkedXlsx) return;
  clearTimeout(xlsxTimer);
  xlsxTimer = setTimeout(syncLinkedExcel, 800);
}

function startExcelWatch() {
  stopExcelWatch();
  if (!linkedXlsx) return;
  watchedPath = linkedXlsx;
  try { lastSyncMtime = fs.existsSync(linkedXlsx) ? fs.statSync(linkedXlsx).mtimeMs : 0; } catch {}
  // watchFile (polling) is reliable across editors/Windows/network shares.
  fs.watchFile(watchedPath, { interval: 1500 }, (curr) => {
    if (!linkedXlsx || applyingExternal) return;
    if (curr.mtimeMs === 0) return;                 // file removed
    if (curr.mtimeMs === lastSyncMtime) return;     // our own write — ignore
    onExternalExcelChange();
  });
}
function stopExcelWatch() {
  if (watchedPath) { try { fs.unwatchFile(watchedPath); } catch {} watchedPath = null; }
}

// Read the externally-edited Excel and merge it into the store (Excel-as-source,
// matched by ID). Updates existing rows + adds new ones; does NOT delete rows
// missing from the file (so a mis-saved sheet can't wipe data — delete in the app).
async function onExternalExcelChange() {
  applyingExternal = true;
  try {
    const data = await importXlsx(linkedXlsx);
    if (!data.tasks.length && !data.procurement.length) return; // empty/parse fail — skip
    applyExcelSync(data);
    const win = BrowserWindow.getAllWindows()[0];
    if (win) win.webContents.reload();
  } catch (e) {
    console.error("external excel import failed:", e.message);
  } finally {
    try { if (fs.existsSync(linkedXlsx)) lastSyncMtime = fs.statSync(linkedXlsx).mtimeMs; } catch {}
    setTimeout(() => { applyingExternal = false; }, 2500); // outlast the 800ms write debounce
  }
}

const TASK_FLAT = ["asm", "task", "pri", "status", "who", "ctrl", "due", "notes"];
const PROC_FLAT = ["item", "supplier", "status", "orderDate", "eta", "cost", "notes"];
function applyExcelSync(data) {
  // --- tasks: match by id, update flat fields, keep app-only fields ---
  const tasks = readArr(KEYS.tasks);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  let maxId = Math.max(0, ...tasks.map((t) => t.id || 0));
  for (const row of data.tasks) {
    if (row.id != null && byId.has(row.id)) {
      const t = byId.get(row.id);
      for (const k of TASK_FLAT) t[k] = row[k] != null ? row[k] : t[k];
      t.tags = row.tags || [];
    } else {
      const nt = { id: ++maxId, asm: row.asm || "", task: row.task, pri: row.pri, status: row.status,
        who: row.who || "", ctrl: row.ctrl || "", due: row.due || "", notes: row.notes || "",
        tags: row.tags || [], checklist: [], comments: [], attachments: [] };
      tasks.push(nt); byId.set(nt.id, nt);
    }
  }
  store.setItem(KEYS.tasks, JSON.stringify(tasks));

  // --- procurement: same merge-by-id ---
  const proc = readArr(KEYS.proc);
  const pById = new Map(proc.map((p) => [p.id, p]));
  let maxPid = Math.max(0, ...proc.map((p) => p.id || 0));
  for (const row of data.procurement) {
    if (row.id != null && pById.has(row.id)) {
      const p = pById.get(row.id);
      for (const k of PROC_FLAT) p[k] = row[k] != null ? row[k] : p[k];
    } else {
      const np = { id: ++maxPid, item: row.item, supplier: row.supplier, status: row.status,
        orderDate: row.orderDate, eta: row.eta, cost: row.cost, notes: row.notes, attachments: [] };
      proc.push(np); pById.set(np.id, np);
    }
  }
  store.setItem(KEYS.proc, JSON.stringify(proc));

  // --- merge new מכלול + people, like a normal import ---
  const asmObj = readObj(KEYS.asm);
  for (const t of tasks) { const a = (t.asm || "").trim(); if (a && !asmObj[a]) asmObj[a] = ASM_PALETTE[Object.keys(asmObj).length % ASM_PALETTE.length]; }
  store.setItem(KEYS.asm, JSON.stringify(asmObj));
  const membersArr = readArr(KEYS.members);
  const haveNames = new Set(membersArr.map((m) => m.name));
  for (const t of tasks) for (const name of [t.who, t.ctrl]) {
    const n = (name || "").trim();
    if (n && !haveNames.has(n)) { haveNames.add(n); membersArr.push({ id: "m_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: n, color: ASM_PALETTE[membersArr.length % ASM_PALETTE.length], isController: false }); }
  }
  store.setItem(KEYS.members, JSON.stringify(membersArr));

  const log = readArr(KEYS.log);
  log.unshift({ ts: new Date().toISOString(), action: "סונכרן מאקסל (עריכה חיצונית)", detail: `${data.tasks.length} משימות · ${data.procurement.length} רכש` });
  store.setItem(KEYS.log, JSON.stringify(log.slice(0, 500)));
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
  const newProc = data.procurement.map((p) => ({ ...p, id: pid++ }));
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
    title: "אקסל מקושר (סנכרון דו-כיווני)",
    defaultPath: linkedXlsx || `מרכז-משימות-חי.xlsx`,
    filters: [{ name: "Excel", extensions: ["xlsx"] }],
  });
  if (canceled || !filePath) return;
  linkedXlsx = filePath;
  store.setConfig("linkedXlsx", filePath);
  await syncLinkedExcel();
  startExcelWatch();
  rebuildMenu(win);
  dialog.showMessageBox(win, {
    type: "info", message: "אקסל מקושר — סנכרון דו-כיווני הופעל",
    detail: `הקובץ:\n${filePath}\n\n• שינויים באפליקציה נכתבים אוטומטית לאקסל.\n• כשתערכו ותשמרו את האקסל — האפליקציה תתעדכן ממנו תוך שניות (התאמה לפי עמודת "מזהה"; אל תמחקו אותה).\n• תת-משימות, הערות וקבצים מצורפים נשמרים גם בעדכון מאקסל.\n• מחיקת שורה באקסל לא מוחקת באפליקציה (כדי למנוע אובדן מידע בטעות) — מחקו מהאפליקציה.`,
  });
}
function unlinkExcel(win) {
  stopExcelWatch();
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
          ? { label: `נתק אקסל מקושר  (${path.basename(linkedXlsx)})`, click: () => unlinkExcel(win) }
          : { label: "קשר אקסל (סנכרון דו-כיווני)…", click: () => linkExcel(win) },
        linkedXlsx ? { label: "פתח את האקסל המקושר", click: () => shell.openPath(linkedXlsx) } : { type: "separator" },
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
  if (linkedXlsx) startExcelWatch(); // resume two-way sync for an already-linked file
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => {
  try { store.persist(); } catch {}
  if (process.platform !== "darwin") app.quit();
});
