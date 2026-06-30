// Export tasks + procurement to a real .xlsx workbook (RTL), for the desktop app.
const ExcelJS = require("exceljs");

// Colors mirror the app (constants.js) so the linked Excel reads like a dashboard.
const STATUS_COLORS = { "טרם התחיל": "7D8590", "בוצע": "3FB950", "בעבודה": "E8C547", "תקוע": "F85149", "לבדיקה": "F778BA" };
const PRI_COLORS = { "גבוה": "FF7B72", "בינוני": "E3B341", "נמוך": "9AA5B1" };
const PROC_STATUS_COLORS = { "להזמין": "F85149", "הוזמן": "E8C547", "בדרך": "58A6FF", "הגיע": "3FB950" };

const hex6 = (c) => String(c || "5A6573").replace("#", "").slice(0, 6).padStart(6, "0");
const argb = (c) => "FF" + hex6(c);
function readableARGB(c) {
  const h = hex6(c);
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? "FF0D1117" : "FFFFFFFF";
}
// Paint a cell with a solid background + readable, centered text.
function paint(cell, color) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(color) } };
  cell.font = { ...(cell.font || {}), bold: true, color: { argb: readableARGB(color) } };
  cell.alignment = { ...(cell.alignment || {}), horizontal: "center", vertical: "middle" };
}

function styleHeader(row) {
  row.font = { bold: true, color: { argb: "FF0D1117" } };
  row.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8B84B" } };
    c.alignment = { vertical: "middle", horizontal: "center" };
  });
}

async function exportXlsx(filePath, { tasks = [], procurement = [], projectName = "", assemblies = {} }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Mission Control";
  wb.created = new Date();
  if (projectName) { wb.title = projectName; wb.subject = projectName; }

  // --- Tasks sheet ---
  const ts = wb.addWorksheet("משימות", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  if (projectName) ts.headerFooter.oddHeader = `&C&"-,Bold"${projectName}`;
  ts.columns = [
    { header: "מזהה", key: "id", width: 8 },
    { header: "מכלול", key: "asm", width: 14 },
    { header: "משימה", key: "task", width: 40 },
    { header: "עדיפות", key: "pri", width: 10 },
    { header: "סטטוס", key: "status", width: 12 },
    { header: "מבצע", key: "who", width: 12 },
    { header: "בקר", key: "ctrl", width: 12 },
    { header: "תג\"ב", key: "due", width: 12 },
    { header: "תוויות", key: "tags", width: 20 },
    { header: "תת-משימות", key: "checklist", width: 12 },
    { header: "הערות", key: "notes", width: 40 },
  ];
  for (const t of tasks) {
    const done = (t.checklist || []).filter((c) => c.done).length;
    const total = (t.checklist || []).length;
    ts.addRow({
      id: t.id, asm: t.asm, task: t.task, pri: t.pri, status: t.status, who: t.who, ctrl: t.ctrl,
      due: t.due, tags: (t.tags || []).join(", "),
      checklist: total ? `${done}/${total}` : "", notes: t.notes,
    });
  }
  styleHeader(ts.getRow(1));
  ts.eachRow((row, i) => {
    if (i === 1) return;
    row.alignment = { vertical: "top", wrapText: true };
    const st = String(row.getCell("status").text || "").trim();
    if (STATUS_COLORS[st]) paint(row.getCell("status"), STATUS_COLORS[st]);
    const asmName = String(row.getCell("asm").text || "").trim();
    if (asmName) paint(row.getCell("asm"), assemblies[asmName] || "5A6573");
    const pri = String(row.getCell("pri").text || "").trim();
    if (PRI_COLORS[pri]) paint(row.getCell("pri"), PRI_COLORS[pri]);
  });

  // --- Procurement sheet ---
  const ps = wb.addWorksheet("בקרת רכש", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  ps.columns = [
    { header: "מזהה", key: "id", width: 8 },
    { header: "פריט", key: "item", width: 30 },
    { header: "ספק", key: "supplier", width: 18 },
    { header: "סטטוס", key: "status", width: 12 },
    { header: "תאריך הזמנה", key: "orderDate", width: 14 },
    { header: "צפי הגעה", key: "eta", width: 14 },
    { header: "עלות", key: "cost", width: 12 },
    { header: "הערות", key: "notes", width: 36 },
  ];
  for (const p of procurement) ps.addRow({ id: p.id, item: p.item, supplier: p.supplier, status: p.status, orderDate: p.orderDate, eta: p.eta, cost: p.cost, notes: p.notes });
  styleHeader(ps.getRow(1));
  ps.eachRow((row, i) => {
    if (i === 1) return;
    const st = String(row.getCell("status").text || "").trim();
    if (PROC_STATUS_COLORS[st]) paint(row.getCell("status"), PROC_STATUS_COLORS[st]);
  });

  await wb.xlsx.writeFile(filePath);
  return filePath;
}

// ----- valid values (for normalization on import) -----
const STATUSES = ["טרם התחיל", "בעבודה", "תקוע", "לבדיקה", "בוצע"];
const PRIORITIES = ["גבוה", "בינוני", "נמוך"];
const PROC_STATUSES = ["להזמין", "הוזמן", "בדרך", "הגיע"];
const pick = (val, set, fallback) => { const v = (val || "").trim(); return set.includes(v) ? v : fallback; };

function headerMap(sheet) {
  const map = [];
  sheet.getRow(1).eachCell((cell, col) => map.push({ text: String(cell.text || "").trim(), col }));
  return map;
}
function findCol(cols, keys) {
  const hit = cols.find((c) => keys.some((k) => c.text.includes(k)));
  return hit ? hit.col : null;
}
function cellText(row, col) { return col ? String(row.getCell(col).text || "").trim() : ""; }
// Read a date column: if Excel parsed it as a real Date cell, format it as D.M.YY
// (our canonical due format) instead of relying on the locale-formatted text.
function cellDue(row, col) {
  if (!col) return "";
  const v = row.getCell(col).value;
  const d = v instanceof Date ? v : (v && v.result instanceof Date ? v.result : null);
  if (d) return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.${String(d.getUTCFullYear()).slice(2)}`;
  return cellText(row, col);
}
function splitTags(s) { return s ? s.split(/[,;،]/).map((x) => x.trim()).filter(Boolean) : []; }
function parseId(s) { const n = parseInt(String(s).trim(), 10); return Number.isFinite(n) ? n : null; }

// Read a workbook (in the export format) back into { tasks, procurement }.
// Robust to column order; matches by header text. No ids — caller assigns them.
async function importXlsx(filePath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const tasks = [];
  const procurement = [];

  const taskSheet = wb.worksheets.find((s) => /משימ/.test(s.name)) || wb.worksheets[0];
  if (taskSheet) {
    const cols = headerMap(taskSheet);
    const g = (row, keys) => cellText(row, findCol(cols, keys));
    taskSheet.eachRow((row, i) => {
      if (i === 1) return;
      const task = g(row, ["משימה"]);
      if (!task) return;
      tasks.push({
        id: parseId(g(row, ["מזהה"])),
        asm: g(row, ["מכלול"]),
        task,
        pri: pick(g(row, ["עדיפות"]), PRIORITIES, "בינוני"),
        status: pick(g(row, ["סטטוס"]), STATUSES, "בעבודה"),
        who: g(row, ["מבצע"]),
        ctrl: g(row, ["בקר"]),
        due: cellDue(row, findCol(cols, ["תג"])),
        tags: splitTags(g(row, ["תווי", "תגי"])),
        notes: g(row, ["הער"]),
      });
    });
  }

  const procSheet = wb.worksheets.find((s) => /רכש/.test(s.name));
  if (procSheet) {
    const cols = headerMap(procSheet);
    const g = (row, keys) => cellText(row, findCol(cols, keys));
    procSheet.eachRow((row, i) => {
      if (i === 1) return;
      const item = g(row, ["פריט"]);
      if (!item) return;
      procurement.push({
        id: parseId(g(row, ["מזהה"])),
        item,
        supplier: g(row, ["ספק"]),
        status: pick(g(row, ["סטטוס"]), PROC_STATUSES, "להזמין"),
        orderDate: g(row, ["הזמנה"]),
        eta: g(row, ["הגעה", "צפי"]),
        cost: g(row, ["עלות"]),
        notes: g(row, ["הער"]),
      });
    });
  }
  return { tasks, procurement };
}

// Write a blank template (same columns as the export) + an instructions sheet
// listing the valid status/priority values, so the user can fill it and import.
async function templateXlsx(filePath, { assemblies = [], members = [] } = {}) {
  await exportXlsx(filePath, {
    tasks: [{ asm: assemblies[0] || "כללי", task: "דוגמה — מחק שורה זו", pri: "בינוני", status: "בעבודה", who: members[0] || "", ctrl: "", due: "1.7.26", tags: [], checklist: [], notes: "" }],
    procurement: [{ item: "דוגמה — מחק שורה זו", supplier: "", status: "להזמין", orderDate: "", eta: "", cost: "", notes: "" }],
  });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const info = wb.addWorksheet("הוראות", { views: [{ rightToLeft: true }] });
  info.columns = [{ width: 22 }, { width: 60 }];
  const rows = [
    ["מילוי התבנית", ""],
    ["", "מלאו את גיליון \"משימות\" ואת \"בקרת רכש\". כל שורה = פריט אחד. אל תשנו את שמות העמודות."],
    ["", "מחקו את שורת הדוגמה לפני הייבוא."],
    ["סטטוס משימה", STATUSES.join("  |  ")],
    ["עדיפות", PRIORITIES.join("  |  ")],
    ["סטטוס רכש", PROC_STATUSES.join("  |  ")],
    ["תג\"ב (תאריך)", "פורמט DD.M.YY, למשל 18.6.26"],
    ["תוויות", "מופרדות בפסיק, למשל: קריטי, מחכה לספק"],
    ["מכלולים קיימים", assemblies.join("  |  ") || "(הגדירו במסך מכלולים)"],
    ["חברי צוות", members.join("  |  ") || "(הגדירו במסך צוות)"],
  ];
  rows.forEach((r) => { const row = info.addRow(r); row.getCell(1).font = { bold: true }; row.getCell(2).alignment = { wrapText: true }; });
  await wb.xlsx.writeFile(filePath);
  return filePath;
}

module.exports = { exportXlsx, importXlsx, templateXlsx };
