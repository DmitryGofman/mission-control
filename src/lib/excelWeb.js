// Browser-side Excel import/export (web app). exceljs is lazy-loaded so it
// doesn't bloat the initial bundle — only fetched when the user actually uses an
// Excel action. Mirrors the column layout & parsing of desktop/excel.js.

let _xlsx = null;
async function ExcelJS() {
  if (!_xlsx) _xlsx = (await import("exceljs")).default || (await import("exceljs"));
  return _xlsx;
}

const STATUSES = ["טרם התחיל", "בעבודה", "תקוע", "לבדיקה", "בוצע"];
const PRIORITIES = ["גבוה", "בינוני", "נמוך"];
const PROC_STATUSES = ["להזמין", "הוזמן", "בדרך", "הגיע"];
const pick = (val, set, fb) => { const v = (val || "").trim(); return set.includes(v) ? v : fb; };

function styleHeader(row) {
  row.font = { bold: true, color: { argb: "FF0D1117" } };
  row.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8B84B" } };
    c.alignment = { vertical: "middle", horizontal: "center" };
  });
}

function buildWorkbook(ExcelJSlib, { tasks = [], procurement = [], projectName = "" }) {
  const wb = new ExcelJSlib.Workbook();
  wb.creator = "Mission Control";
  wb.created = new Date();
  if (projectName) { wb.title = projectName; wb.subject = projectName; }

  const ts = wb.addWorksheet("משימות", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  if (projectName) ts.headerFooter.oddHeader = `&C&"-,Bold"${projectName}`;
  ts.columns = [
    { header: "מכלול", key: "asm", width: 14 }, { header: "משימה", key: "task", width: 40 },
    { header: "עדיפות", key: "pri", width: 10 }, { header: "סטטוס", key: "status", width: 12 },
    { header: "מבצע", key: "who", width: 12 }, { header: "בקר", key: "ctrl", width: 12 },
    { header: "תג\"ב", key: "due", width: 12 }, { header: "תוויות", key: "tags", width: 20 },
    { header: "תת-משימות", key: "checklist", width: 12 }, { header: "הערות", key: "notes", width: 40 },
  ];
  for (const t of tasks) {
    const done = (t.checklist || []).filter((c) => c.done).length, total = (t.checklist || []).length;
    ts.addRow({ asm: t.asm, task: t.task, pri: t.pri, status: t.status, who: t.who, ctrl: t.ctrl,
      due: t.due, tags: (t.tags || []).join(", "), checklist: total ? `${done}/${total}` : "", notes: t.notes });
  }
  styleHeader(ts.getRow(1));
  ts.eachRow((row, i) => { if (i > 1) row.alignment = { vertical: "top", wrapText: true }; });

  const ps = wb.addWorksheet("בקרת רכש", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  ps.columns = [
    { header: "פריט", key: "item", width: 30 }, { header: "מכלול", key: "asm", width: 14 },
    { header: "אחראי רכש", key: "supplier", width: 14 },
    { header: "סטטוס", key: "status", width: 12 }, { header: "תאריך הזמנה", key: "orderDate", width: 14 },
    { header: "צפי הגעה", key: "eta", width: 14 }, { header: "עלות", key: "cost", width: 12 },
    { header: "הערות", key: "notes", width: 36 },
  ];
  for (const p of procurement) ps.addRow(p);
  styleHeader(ps.getRow(1));
  return wb;
}

async function downloadWorkbook(wb, filename) {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export async function exportXlsx({ tasks, procurement, projectName }) {
  const lib = await ExcelJS();
  const wb = buildWorkbook(lib, { tasks, procurement, projectName });
  const safe = (projectName || "מרכז-משימות").trim().replace(/[\\/:*?"<>|]/g, "-");
  await downloadWorkbook(wb, `${safe}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function templateXlsx({ assemblies = [], members = [], projectName = "" }) {
  const lib = await ExcelJS();
  const wb = buildWorkbook(lib, {
    tasks: [{ asm: assemblies[0] || "כללי", task: "דוגמה — מחק שורה זו", pri: "בינוני", status: "בעבודה", who: members[0] || "", ctrl: "", due: "1.7.26", tags: [], checklist: [], notes: "" }],
    procurement: [{ item: "דוגמה — מחק שורה זו", supplier: "", status: "להזמין", orderDate: "", eta: "", cost: "", notes: "" }],
    projectName,
  });
  const info = wb.addWorksheet("הוראות", { views: [{ rightToLeft: true }] });
  info.columns = [{ width: 22 }, { width: 60 }];
  [
    ["מילוי התבנית", ""],
    ["", 'מלאו את גיליון "משימות" ואת "בקרת רכש". אל תשנו את שמות העמודות. מחקו את שורת הדוגמה לפני הייבוא.'],
    ["סטטוס משימה", STATUSES.join("  |  ")], ["עדיפות", PRIORITIES.join("  |  ")],
    ["סטטוס רכש", PROC_STATUSES.join("  |  ")], ["תג\"ב (תאריך)", "פורמט DD.M.YY, למשל 18.6.26"],
    ["תוויות", "מופרדות בפסיק"], ["מכלולים קיימים", assemblies.join("  |  ") || "(הגדירו במסך מכלולים)"],
    ["חברי צוות", members.join("  |  ") || "(הגדירו במסך צוות)"],
  ].forEach((r) => { const row = info.addRow(r); row.getCell(1).font = { bold: true }; row.getCell(2).alignment = { wrapText: true }; });
  await downloadWorkbook(wb, "תבנית-מרכז-משימות.xlsx");
}

function headerMap(sheet) { const m = []; sheet.getRow(1).eachCell((c, col) => m.push({ text: String(c.text || "").trim(), col })); return m; }
function findCol(cols, keys) { const h = cols.find((c) => keys.some((k) => c.text.includes(k))); return h ? h.col : null; }
function cellText(row, col) { return col ? String(row.getCell(col).text || "").trim() : ""; }
// Read a date column: if Excel parsed it as a real Date cell, format it as D.M.YY
// (our canonical due format) instead of using the locale-formatted display text.
function cellDue(row, col) {
  if (!col) return "";
  const v = row.getCell(col).value;
  const d = v instanceof Date ? v : (v && v.result instanceof Date ? v.result : null);
  if (d) return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.${String(d.getUTCFullYear()).slice(2)}`;
  return cellText(row, col);
}
function splitTags(s) { return s ? s.split(/[,;،]/).map((x) => x.trim()).filter(Boolean) : []; }

// Parse a File (from an <input type=file>) into { tasks, procurement } (no ids).
export async function importXlsx(file) {
  const lib = await ExcelJS();
  const wb = new lib.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const tasks = [], procurement = [];

  const taskSheet = wb.worksheets.find((s) => /משימ/.test(s.name)) || wb.worksheets[0];
  if (taskSheet) {
    const cols = headerMap(taskSheet);
    const g = (row, keys) => cellText(row, findCol(cols, keys));
    taskSheet.eachRow((row, i) => {
      if (i === 1) return;
      const task = g(row, ["משימה"]);
      if (!task) return;
      tasks.push({ asm: g(row, ["מכלול"]), task,
        pri: pick(g(row, ["עדיפות"]), PRIORITIES, "בינוני"), status: pick(g(row, ["סטטוס"]), STATUSES, "בעבודה"),
        who: g(row, ["מבצע"]), ctrl: g(row, ["בקר"]), due: cellDue(row, findCol(cols, ["תג"])),
        tags: splitTags(g(row, ["תווי", "תגי"])), notes: g(row, ["הער"]) });
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
      procurement.push({ item, asm: g(row, ["מכלול"]), supplier: g(row, ["אחראי", "ספק"]), status: pick(g(row, ["סטטוס"]), PROC_STATUSES, "להזמין"),
        orderDate: g(row, ["הזמנה"]), eta: g(row, ["הגעה", "צפי"]), cost: g(row, ["עלות"]), notes: g(row, ["הער"]) });
    });
  }
  return { tasks, procurement };
}
