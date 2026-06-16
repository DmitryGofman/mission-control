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

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY, asm TEXT, task TEXT, pri TEXT, status TEXT,
  who TEXT, ctrl TEXT, due TEXT, notes TEXT,
  tags TEXT, checklist TEXT, comments TEXT, attachments TEXT
);
CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, name TEXT, color TEXT, isController INTEGER);
CREATE TABLE IF NOT EXISTS procurement (
  id INTEGER PRIMARY KEY, item TEXT, supplier TEXT, status TEXT,
  orderDate TEXT, eta TEXT, cost TEXT, notes TEXT
);
CREATE TABLE IF NOT EXISTS audit_log (seq INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, action TEXT, detail TEXT);
CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, type TEXT, data BLOB);
`;

async function init(targetPath) {
  const wasmDir = path.dirname(require.resolve("sql.js"));
  const SQL = await initSqlJs({ locateFile: (f) => path.join(wasmDir, f) });
  dbPath = targetPath;
  db = fs.existsSync(dbPath) ? new SQL.Database(fs.readFileSync(dbPath)) : new SQL.Database();
  db.run(SCHEMA);
  persist();
  return dbPath;
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
  if (!table) return null;
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
  }
  return JSON.stringify(objs);
}

// Mirrors localStorage.setItem: replaces the table contents from the JSON array.
function setItem(key, json) {
  const table = tableFor(key);
  if (!table) return;
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
    const st = db.prepare("INSERT INTO procurement(id,item,supplier,status,orderDate,eta,cost,notes) VALUES (?,?,?,?,?,?,?,?)");
    for (const p of arr) st.run([p.id, p.item, p.supplier, p.status, p.orderDate, p.eta, p.cost, p.notes]);
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

function putBlob(id, bytes, type) {
  db.run("INSERT OR REPLACE INTO attachments(id,type,data) VALUES (?,?,?)", [id, type, bytes]);
  persist();
}
function getBlob(id) {
  const res = db.exec("SELECT type,data FROM attachments WHERE id=?", [id]);
  if (!res.length) return null;
  const [type, data] = res[0].values[0];
  return { type, bytes: Buffer.from(data) };
}
function deleteBlob(id) {
  db.run("DELETE FROM attachments WHERE id=?", [id]);
  persist();
}

module.exports = { init, getItem, setItem, putBlob, getBlob, deleteBlob, persist, getDbPath: () => dbPath };
