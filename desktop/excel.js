// Export tasks + procurement to a real .xlsx workbook (RTL), for the desktop app.
const ExcelJS = require("exceljs");

function styleHeader(row) {
  row.font = { bold: true, color: { argb: "FF0D1117" } };
  row.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8B84B" } };
    c.alignment = { vertical: "middle", horizontal: "center" };
  });
}

async function exportXlsx(filePath, { tasks = [], procurement = [] }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Mission Control";
  wb.created = new Date();

  // --- Tasks sheet ---
  const ts = wb.addWorksheet("משימות", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
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

module.exports = { exportXlsx };
