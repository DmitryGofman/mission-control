// Pure row-level merge for the shared linked-Excel multi-user mode.
// No Electron/fs deps → unit-testable. The shared Excel is the transport; each
// client merges so concurrent edits to DIFFERENT rows never clobber each other.
//
// Rules (per-field last-writer-wins, "Excel is the source"):
//  - Rows the local user changed since last sync ("dirty") → local version wins.
//  - Rows the local user deleted → removed (excluded from output).
//  - All other rows → taken from the fresh file, but the local machine's
//    app-only fields (checklist/comments/attachments) are preserved.
//  - Brand-new rows in the file with no ID → added with a fresh local ID.

const TASK_FLAT = ["asm", "task", "pri", "status", "who", "ctrl", "due", "notes"];
const PROC_FLAT = ["item", "supplier", "status", "orderDate", "eta", "cost", "notes"];

// A signature of just the Excel-carried (flat) fields, to detect real changes
// (app-only edits like checklists don't need a shared write).
function flatSigTask(t) { return JSON.stringify(TASK_FLAT.map((k) => t[k] ?? "").concat([(t.tags || []).join("|")])); }
function flatSigProc(p) { return JSON.stringify(PROC_FLAT.map((k) => p[k] ?? "")); }

function mergeTasks(fresh, local, dirty, deleted) {
  const localById = new Map(local.map((t) => [t.id, t]));
  const freshById = new Map(fresh.filter((t) => t.id != null).map((t) => [t.id, t]));
  const ids = new Set(freshById.keys());
  for (const id of dirty) ids.add(id);
  for (const id of deleted) ids.delete(id);
  const out = [];
  for (const id of ids) {
    if (dirty.has(id)) { const l = localById.get(id); if (l) out.push(l); } // our row wins (full, incl app-only)
    else {
      const f = freshById.get(id), l = localById.get(id);
      out.push({ ...f, checklist: (l && l.checklist) || [], comments: (l && l.comments) || [], attachments: (l && l.attachments) || [] });
    }
  }
  let maxId = Math.max(0, ...local.map((t) => t.id || 0), ...out.map((t) => t.id || 0));
  for (const f of fresh) if (f.id == null && f.task) out.push({ ...f, id: ++maxId, checklist: [], comments: [], attachments: [] });
  return out;
}

function mergeProc(fresh, local, dirty, deleted) {
  const localById = new Map(local.map((p) => [p.id, p]));
  const freshById = new Map(fresh.filter((p) => p.id != null).map((p) => [p.id, p]));
  const ids = new Set(freshById.keys());
  for (const id of dirty) ids.add(id);
  for (const id of deleted) ids.delete(id);
  const out = [];
  for (const id of ids) {
    if (dirty.has(id)) { const l = localById.get(id); if (l) out.push(l); }
    else { const f = freshById.get(id), l = localById.get(id); out.push({ ...f, attachments: (l && l.attachments) || [] }); }
  }
  let maxId = Math.max(0, ...local.map((p) => p.id || 0), ...out.map((p) => p.id || 0));
  for (const f of fresh) if (f.id == null && f.item) out.push({ ...f, id: ++maxId, attachments: [] });
  return out;
}

module.exports = { mergeTasks, mergeProc, flatSigTask, flatSigProc, TASK_FLAT, PROC_FLAT };
