// SQLite-backed store for the desktop app, using sql.js (pure WASM — no native
// build step). The whole DB is a single file (mission-control.db) in the app
// folder. The renderer keeps calling loadJSON/saveJSON/putBlob exactly as on the
// web; main.js routes those calls here.
//
// Data is stored in real, queryable tables (tasks/members/procurement/
// audit_log/attachments) so you can open the .db in any SQLite tool. Nested
// task fields (tags/checklist/comments/attachments-metadata) are JSON columns.

const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

let db = null;
let dbPath = null;
let attachDir = null; // <data dir>/attachments — real files live here

function safeName(name) {
  // Strip only filesystem-illegal characters; keep spaces/dots so names stay readable.
  return String(name || "file").replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 120) || "file";
}
function attachFileName(id, name) { return `${id}__${safeName(name)}`; }

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY, asm TEXT, task TEXT, pri TEXT, status TEXT,
  who TEXT, ctrl TEXT, due TEXT, notes TEXT,
  tags TEXT, checklist TEXT, comments TEXT, attachments TEXT
);
CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, name TEXT, color TEXT, isController INTEGER);
CREATE TABLE IF NOT EXISTS procurement (
  id INTEGER PRIMARY KEY, item TEXT, supplier TEXT, asm TEXT, status TEXT,
  orderDate TEXT, eta TEXT, cost TEXT, notes TEXT, attachments TEXT
);
CREATE TABLE IF NOT EXISTS audit_log (seq INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, action TEXT, detail TEXT);
CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, type TEXT, data BLOB);
CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
`;

async function init(targetPath) {
  const wasmDir = path.dirname(require.resolve("sql.js"));
  const SQL = await initSqlJs({ locateFile: (f) => path.join(wasmDir, f) });
  dbPath = targetPath;
  db = fs.existsSync(dbPath) ? new SQL.Database(fs.readFileSync(dbPath)) : new SQL.Database();
  db.run(SCHEMA);
  // Attachments now live as real files in <data dir>/attachments so they're
  // browsable/openable. The DB keeps metadata + the on-disk filename.
  attachDir = path.join(path.dirname(dbPath), "attachments");
  fs.mkdirSync(attachDir, { recursive: true });
  ensureAttachmentCols();
  ensureProcCols();
  migrateBlobsToFiles();
  persist();
  return dbPath;
}

// Add the name/file columns to older databases that predate folder storage.
function ensureAttachmentCols() {
  const info = db.exec("PRAGMA table_info(attachments)");
  const cols = info.length ? info[0].values.map((r) => r[1]) : [];
  if (!cols.includes("name")) db.run("ALTER TABLE attachments ADD COLUMN name TEXT");
  if (!cols.includes("file")) db.run("ALTER TABLE attachments ADD COLUMN file TEXT");
}

// Add the attachments column to older procurement tables.
function ensureProcCols() {
  const info = db.exec("PRAGMA table_info(procurement)");
  const cols = info.length ? info[0].values.map((r) => r[1]) : [];
  if (!cols.includes("attachments")) db.run("ALTER TABLE procurement ADD COLUMN attachments TEXT");
  if (!cols.includes("asm")) db.run("ALTER TABLE procurement ADD COLUMN asm TEXT");
}

// One-time migration: any attachment still held as a BLOB in the DB is written
// out to a real file in the attachments folder (named from the task metadata
// where available), and the BLOB is cleared.
function migrateBlobsToFiles() {
  const res = db.exec("SELECT id,type,data FROM attachments WHERE data IS NOT NULL AND (file IS NULL OR file='')");
  if (!res.length) return;
  const names = attachmentNames();
  for (const [id, , data] of res[0].values) {
    if (data == null) continue;
    const fname = attachFileName(id, names[id] || id);
    try {
      fs.writeFileSync(path.join(attachDir, fname), Buffer.from(data));
      db.run("UPDATE attachments SET file=?, name=?, data=NULL WHERE id=?", [fname, names[id] || null, id]);
    } catch (e) { console.error("attachment migrate failed", id, e.message); }
  }
}

// Map attachment id -> original filename, read from the tasks' attachment JSON.
function attachmentNames() {
  const map = {};
  try {
    const res = db.exec("SELECT attachments FROM tasks WHERE attachments IS NOT NULL");
    if (res.length) for (const [json] of res[0].values) {
      for (const a of JSON.parse(json || "[]")) if (a && a.id) map[a.id] = a.name;
    }
  } catch {}
  return map;
}

function persist() {
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
}

function getMeta(k) {
  const r = db.exec("SELECT v FROM meta WHERE k=?", [k]);
  return r.length ? r[0].values[0][0] : null;
}
function setMeta(k, v) { db.run("INSERT OR REPLACE INTO meta(k,v) VALUES(?,?)", [k, v]); }

function tableFor(key) {
  if (key.includes("tasks")) return "tasks";
  if (key.includes("members")) return "members";
  if (key.includes("procurement")) return "procurement";
  if (key.includes("audit")) return "audit_log";
  return null;
}

function rowsToObjects(res) {
  if (!res.length) return [];
  const { columns, values } = res[0];
  return values.map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
}

// Mirrors localStorage.getItem: returns a JSON string, or null on first run so
// the app falls back to its seed data.
function getItem(key) {
  if (getMeta("init") !== "1") return null;
  const table = tableFor(key);
  if (!table) {
    // Generic key/value (e.g. the מכלול list) — stored as JSON in `kv`.
    const r = db.exec("SELECT v FROM kv WHERE k=?", [key]);
    return r.length ? r[0].values[0][0] : null;
  }
  if (table === "audit_log") {
    const objs = rowsToObjects(db.exec("SELECT ts,action,detail FROM audit_log ORDER BY seq"));
    return JSON.stringify(objs);
  }
  let objs = rowsToObjects(db.exec(`SELECT * FROM ${table}`));
  if (table === "tasks") {
    objs = objs.map((t) => ({
      ...t,
      tags: JSON.parse(t.tags || "[]"),
      checklist: JSON.parse(t.checklist || "[]"),
      comments: JSON.parse(t.comments || "[]"),
      attachments: JSON.parse(t.attachments || "[]"),
    }));
  } else if (table === "members") {
    objs = objs.map((m) => ({ ...m, isController: !!m.isController }));
  } else if (table === "procurement") {
    objs = objs.map((p) => ({ ...p, attachments: JSON.parse(p.attachments || "[]") }));
  }
  return JSON.stringify(objs);
}

// Mirrors localStorage.setItem: replaces the table contents from the JSON array.
function setItem(key, json) {
  const table = tableFor(key);
  if (!table) {
    db.run("INSERT OR REPLACE INTO kv(k,v) VALUES(?,?)", [key, json]);
    setMeta("init", "1");
    persist();
    return;
  }
  const arr = JSON.parse(json);
  db.run("BEGIN");
  db.run(`DELETE FROM ${table}`);
  if (table === "tasks") {
    const st = db.prepare("INSERT INTO tasks(id,asm,task,pri,status,who,ctrl,due,notes,tags,checklist,comments,attachments) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)");
    for (const t of arr) st.run([t.id, t.asm, t.task, t.pri, t.status, t.who, t.ctrl, t.due, t.notes,
      JSON.stringify(t.tags || []), JSON.stringify(t.checklist || []), JSON.stringify(t.comments || []), JSON.stringify(t.attachments || [])]);
    st.free();
  } else if (table === "members") {
    const st = db.prepare("INSERT INTO members(id,name,color,isController) VALUES (?,?,?,?)");
    for (const m of arr) st.run([m.id, m.name, m.color, m.isController ? 1 : 0]);
    st.free();
  } else if (table === "procurement") {
    const st = db.prepare("INSERT INTO procurement(id,item,supplier,asm,status,orderDate,eta,cost,notes,attachments) VALUES (?,?,?,?,?,?,?,?,?,?)");
    for (const p of arr) st.run([p.id, p.item, p.supplier, p.asm || "", p.status, p.orderDate, p.eta, p.cost, p.notes, JSON.stringify(p.attachments || [])]);
    st.free();
  } else if (table === "audit_log") {
    const st = db.prepare("INSERT INTO audit_log(ts,action,detail) VALUES (?,?,?)");
    for (const e of arr) st.run([e.ts, e.action, e.detail]);
    st.free();
  }
  setMeta("init", "1");
  db.run("COMMIT");
  persist();
}

function putBlob(id, bytes, type, name) {
  const fname = attachFileName(id, name);
  fs.writeFileSync(path.join(attachDir, fname), Buffer.from(bytes));
  db.run("INSERT OR REPLACE INTO attachments(id,type,name,data,file) VALUES (?,?,?,NULL,?)", [id, type, name || null, fname]);
  persist();
}
function getBlob(id) {
  const res = db.exec("SELECT type,data,file FROM attachments WHERE id=?", [id]);
  if (!res.length) return null;
  const [type, data, file] = res[0].values[0];
  if (file) {
    const fpath = path.join(attachDir, file);
    if (!fs.existsSync(fpath)) return null;
    return { type, bytes: fs.readFileSync(fpath) };
  }
  return data != null ? { type, bytes: Buffer.from(data) } : null; // legacy BLOB fallback
}
function deleteBlob(id) {
  const res = db.exec("SELECT file FROM attachments WHERE id=?", [id]);
  if (res.length) {
    const file = res[0].values[0][0];
    if (file) { try { fs.unlinkSync(path.join(attachDir, file)); } catch {} }
  }
  db.run("DELETE FROM attachments WHERE id=?", [id]);
  persist();
}
// Absolute path to an attachment file (for opening / revealing in the OS).
function getAttachmentPath(id) {
  const res = db.exec("SELECT file FROM attachments WHERE id=?", [id]);
  if (!res.length) return null;
  const file = res[0].values[0][0];
  return file ? path.join(attachDir, file) : null;
}
function getAttachDir() { return attachDir; }

// App config (e.g. the linked-Excel path) stored in the meta table.
function getConfig(key) { return getMeta("cfg:" + key); }
function setConfig(key, value) {
  if (value == null) db.run("DELETE FROM meta WHERE k=?", ["cfg:" + key]);
  else setMeta("cfg:" + key, String(value));
  persist();
}

module.exports = { init, getItem, setItem, putBlob, getBlob, deleteBlob, persist, getConfig, setConfig, getDbPath: () => dbPath, getAttachmentPath, getAttachDir };
