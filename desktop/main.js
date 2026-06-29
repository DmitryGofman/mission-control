const { app, BrowserWindow, ipcMain, Menu, shell, dialog, session } = require("electron");
const fs = require("fs");
const path = require("path");
const store = require("./store");
const { exportXlsx, importXlsx, templateXlsx } = require("./excel");
const { mergeTasks, mergeProc, flatSigTask, flatSigProc } = require("./syncmerge");

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

// ---------- linked Excel: shared multi-user sync (lock + row-level merge) ----------
// The linked Excel acts as a shared database for ~5 people. On any local change
// we LOCK the file, read it fresh, merge our changed rows on top (others' rows
// preserved), write, unlock — so concurrent edits to different rows never clobber.
// We also watch the file and pull others' changes live into the UI.
const LOCK_TTL = 12000; // ms; a lock older than this is considered stale & stolen
let syncBaseTasks = new Map(); // id -> flat signature at last sync (to detect local edits)
let syncBaseProc = new Map();
const dirtyTasks = new Set(), deletedTasks = new Set();
const dirtyProc = new Set(), deletedProc = new Set();
let retryTimer = null;

function lockPath() { return linkedXlsx + ".lock"; }
function acquireLock() {
  try { fs.writeFileSync(lockPath(), JSON.stringify({ pid: process.pid, ts: Date.now() }), { flag: "wx" }); return true; }
  catch (e) {
    if (e.code !== "EEXIST") return false;
    let stale = true;
    try { stale = (Date.now() - (JSON.parse(fs.readFileSync(lockPath(), "utf8")).ts || 0)) > LOCK_TTL; } catch {}
    if (!stale) return false;
    try { fs.writeFileSync(lockPath(), JSON.stringify({ pid: process.pid, ts: Date.now() })); return true; } catch { return false; }
  }
}
function releaseLock() { try { fs.unlinkSync(lockPath()); } catch {} }

function setBase(tasks, proc) {
  syncBaseTasks = new Map(tasks.map((t) => [t.id, flatSigTask(t)]));
  syncBaseProc = new Map(proc.map((p) => [p.id, flatSigProc(p)]));
}
// Record which rows the local user changed/deleted since last sync. Returns true
// if anything flat actually changed (so we know to push to the shared file).
function trackDirty(key, json) {
  let changed = false;
  if (key.includes("tasks")) {
    const arr = JSON.parse(json || "[]"); const ids = new Set();
    for (const t of arr) { ids.add(t.id); if (syncBaseTasks.get(t.id) !== flatSigTask(t)) { dirtyTasks.add(t.id); changed = true; } }
    for (const id of syncBaseTasks.keys()) if (!ids.has(id)) { deletedTasks.add(id); dirtyTasks.delete(id); changed = true; }
  } else if (key.includes("procurement")) {
    const arr = JSON.parse(json || "[]"); const ids = new Set();
    for (const p of arr) { ids.add(p.id); if (syncBaseProc.get(p.id) !== flatSigProc(p)) { dirtyProc.add(p.id); changed = true; } }
    for (const id of syncBaseProc.keys()) if (!ids.has(id)) { deletedProc.add(id); dirtyProc.delete(id); changed = true; }
  }
  return changed;
}

function scheduleXlsxSync() {
  if (!linkedXlsx) return;
  clearTimeout(xlsxTimer);
  xlsxTimer = setTimeout(() => reconcile(), 800);
}
function scheduleRetry() {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => reconcile(), 1500);
}

function startExcelWatch() {
  stopExcelWatch();
  if (!linkedXlsx) return;
  watchedPath = linkedXlsx;
  try { lastSyncMtime = fs.existsSync(linkedXlsx) ? fs.statSync(linkedXlsx).mtimeMs : 0; } catch {}
  fs.watchFile(watchedPath, { interval: 1500 }, (curr) => {
    if (!linkedXlsx || applyingExternal) return;
    if (curr.mtimeMs === 0) return;             // file removed
    if (curr.mtimeMs === lastSyncMtime) return; // our own write — ignore
    reconcile(); // someone else wrote — pull (and push our pending dirty if any)
  });
}
function stopExcelWatch() {
  if (watchedPath) { try { fs.unwatchFile(watchedPath); } catch {} watchedPath = null; }
}

function pushToRenderer() {
  const win = BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) win.webContents.send("mc:dataChanged", {
    tasks: readArr(KEYS.tasks), proc: readArr(KEYS.proc), members: readArr(KEYS.members), assemblies: readObj(KEYS.asm),
  });
}
function notifyBusy() {
  const win = BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed()) win.webContents.send("mc:syncBusy");
}

// The heart of shared sync: read fresh → merge → (write if we have changes) →
// commit to the store, refresh the UI. Lock is held only around read+write.
let reconciling = false;
async function reconcile() {
  if (!linkedXlsx || applyingExternal || reconciling) return;
  const haveDirty = dirtyTasks.size || deletedTasks.size || dirtyProc.size || deletedProc.size;
  let locked = false;
  if (haveDirty) {
    locked = acquireLock();
    if (!locked) { notifyBusy(); scheduleRetry(); return; } // file busy — keep dirty, retry
  }
  reconciling = true; applyingExternal = true;
  try {
    const fresh = fs.existsSync(linkedXlsx) ? await importXlsx(linkedXlsx) : { tasks: [], procurement: [] };
    if (!haveDirty && !fresh.tasks.length && !fresh.procurement.length) return; // empty external read — skip (don't wipe)

    const mergedTasks = mergeTasks(fresh.tasks, readArr(KEYS.tasks), dirtyTasks, deletedTasks);
    const mergedProc = mergeProc(fresh.procurement, readArr(KEYS.proc), dirtyProc, deletedProc);

    if (haveDirty) {
      await exportXlsx(linkedXlsx, { tasks: mergedTasks, procurement: mergedProc, projectName: readStr(KEYS.project), assemblies: readObj(KEYS.asm) });
      try { lastSyncMtime = fs.statSync(linkedXlsx).mtimeMs; } catch {}
    }
    commitMerged(mergedTasks, mergedProc, haveDirty);
  } catch (e) {
    console.error("excel reconcile failed:", e.message);
  } finally {
    reconciling = false;
    if (locked) releaseLock();
    setTimeout(() => { applyingExternal = false; }, 300);
  }
}

function commitMerged(tasks, proc, didWrite) {
  store.setItem(KEYS.tasks, JSON.stringify(tasks));
  store.setItem(KEYS.proc, JSON.stringify(proc));
  // new מכלול + people that arrived from others
  const asmObj = readObj(KEYS.asm);
  for (const t of tasks) { const a = (t.asm || "").trim(); if (a && !asmObj[a]) asmObj[a] = ASM_PALETTE[Object.keys(asmObj).length % ASM_PALETTE.length]; }
  store.setItem(KEYS.asm, JSON.stringify(asmObj));
  const membersArr = readArr(KEYS.members); const haveNames = new Set(membersArr.map((m) => m.name)); let added = false;
  for (const t of tasks) for (const name of [t.who, t.ctrl]) {
    const n = (name || "").trim();
    if (n && !haveNames.has(n)) { haveNames.add(n); added = true; membersArr.push({ id: "m_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: n, color: ASM_PALETTE[membersArr.length % ASM_PALETTE.length], isController: false }); }
  }
  if (added) store.setItem(KEYS.members, JSON.stringify(membersArr));
  setBase(tasks, proc);
  dirtyTasks.clear(); deletedTasks.clear(); dirtyProc.clear(); deletedProc.clear();
  pushToRenderer();
}

// On link / startup: baseline from local, mark local-only rows as dirty (so they
// get pushed, not dropped), start watching, and do a first reconcile (pull others
// + push ours). Safe whether the shared file is new, empty, or already populated.
async function bootstrapLink() {
  if (!linkedXlsx) return;
  dirtyTasks.clear(); deletedTasks.clear(); dirtyProc.clear(); deletedProc.clear();
  const localT = readArr(KEYS.tasks), localP = readArr(KEYS.proc);
  setBase(localT, localP);
  try {
    const fresh = fs.existsSync(linkedXlsx) ? await importXlsx(linkedXlsx) : { tasks: [], procurement: [] };
    const fT = new Set(fresh.tasks.filter((t) => t.id != null).map((t) => t.id));
    for (const t of localT) if (!fT.has(t.id)) dirtyTasks.add(t.id);
    const fP = new Set(fresh.procurement.filter((p) => p.id != null).map((p) => p.id));
    for (const p of localP) if (!fP.has(p.id)) dirtyProc.add(p.id);
  } catch (e) { console.error("bootstrap read failed:", e.message); }
  startExcelWatch();
  reconcile();
}
// Push the entire local dataset to the linked file (used after a manual import).
function pushAllToLinked() {
  if (!linkedXlsx) return;
  setBase([], []);
  for (const t of readArr(KEYS.tasks)) dirtyTasks.add(t.id);
  for (const p of readArr(KEYS.proc)) dirtyProc.add(p.id);
  reconcile();
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
  await exportXlsx(filePath, { tasks: readArr(KEYS.tasks), procurement: readArr(KEYS.proc), projectName: pname, assemblies: readObj(KEYS.asm) });
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

  pushAllToLinked();
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
  await bootstrapLink();
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
  dirtyTasks.clear(); deletedTasks.clear(); dirtyProc.clear(); deletedProc.clear();
  syncBaseTasks = new Map(); syncBaseProc = new Map();
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
    if (linkedXlsx && (key.includes("tasks") || key.includes("procurement"))) {
      if (trackDirty(key, json)) scheduleXlsxSync(); // only sync on a real (flat) change
    }
  });
  ipcMain.on("mc:dbPath", (e) => { e.returnValue = store.getDbPath(); });
  ipcMain.handle("mc:putBlob", (e, id, bytes, type, name) => { store.putBlob(id, bytes, type, name); return true; });
  ipcMain.handle("mc:getBlob", (e, id) => store.getBlob(id));
  ipcMain.handle("mc:deleteBlob", (e, id) => { store.deleteBlob(id); return true; });
  ipcMain.handle("mc:openAttachment", async (e, id) => { const p = store.getAttachmentPath(id); if (p) await shell.openPath(p); return !!p; });
  ipcMain.handle("mc:revealAttachment", (e, id) => { const p = store.getAttachmentPath(id); if (p) shell.showItemInFolder(p); return !!p; });

  createWindow();
  if (linkedXlsx) bootstrapLink(); // resume shared sync for an already-linked file
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => {
  try { store.persist(); } catch {}
  if (process.platform !== "darwin") app.quit();
});
