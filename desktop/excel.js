// Export tasks + procurement to a real .xlsx workbook (RTL), for the desktop app.
const ExcelJS = require("exceljs");

function styleHeader(row) {
  row.font = { bold: true, color: { argb: "FF0D1117" } };
  row.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8B84B" } };
    c.alignment = { vertical: "middle", horizontal: "center" };
  });
}

async function exportXlsx(filePath, { tasks = [], procurement = [], projectName = "" }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Mission Control";
  wb.created = new Date();
  if (projectName) { wb.title = projectName; wb.subject = projectName; }

  // --- Tasks sheet ---
  const ts = wb.addWorksheet("משימות", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  if (projectName) ts.headerFooter.oddHeader = `&C&"-,Bold"${projectName}`;
  ts.columns = [
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
      asm: t.asm, task: t.task, pri: t.pri, status: t.status, who: t.who, ctrl: t.ctrl,
      due: t.due, tags: (t.tags || []).join(", "),
      checklist: total ? `${done}/${total}` : "", notes: t.notes,
    });
  }
  styleHeader(ts.getRow(1));
  ts.eachRow((row, i) => { if (i > 1) row.alignment = { vertical: "top", wrapText: true }; });

  // --- Procurement sheet ---
  const ps = wb.addWorksheet("בקרת רכש", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  ps.columns = [
    { header: "פריט", key: "item", width: 30 },
    { header: "ספק", key: "supplier", width: 18 },
    { header: "סטטוס", key: "status", width: 12 },
    { header: "תאריך הזמנה", key: "orderDate", width: 14 },
    { header: "צפי הגעה", key: "eta", width: 14 },
    { header: "עלות", key: "cost", width: 12 },
    { header: "הערות", key: "notes", width: 36 },
  ];
  for (const p of procurement) ps.addRow(p);
  styleHeader(ps.getRow(1));

  await wb.xlsx.writeFile(filePath);
  return filePath;
}

// ----- valid values (for normalization on import) -----
const STATUSES = ["בעבודה", "תקוע", "לבדיקה", "בוצע"];
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
