import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  STATUSES, STATUS_ORDER, ASSEMBLIES, PRIORITIES, SEED, DEFAULT_MEMBERS, MEMBER_PALETTE,
  PROC_STATUSES, PROC_STATUS_ORDER, PROC_SEED, STORE, readable, initials, tagColor, asmColor,
  startOfToday, addDays, dateToDue, dueToDate, unusedColor,
} from "./lib/constants.js";
import SwipeRow from "./components/SwipeRow.jsx";
import { loadJSON, saveJSON, getBlob } from "./lib/storage.js";
import * as excelWeb from "./lib/excelWeb.js";
import { useEscape } from "./lib/useEscape.js";
import { S, CSS, MUTED, GOLD } from "./lib/styles.js";
import TaskModal from "./components/TaskModal.jsx";
import MembersModal from "./components/MembersModal.jsx";
import AssembliesModal from "./components/AssembliesModal.jsx";
import ProcurementModal from "./components/ProcurementModal.jsx";
import AgendaView from "./components/AgendaView.jsx";

// Human-readable labels for audit diffs.
const FIELD_LABELS = {
  task: "שם", asm: "מכלול", pri: "עדיפות", status: "סטטוס",
  who: "מבצע", ctrl: "בקר", due: "תג״ב", notes: "הערות",
  attachments: "קבצים", checklist: "תת-משימות", tags: "תוויות", comments: "תגובות",
};
const ARRAY_FIELDS = new Set(["attachments", "checklist", "tags", "comments"]);
const UNASSIGNED = "— ללא משויך —"; // by-person filter option for tasks with no/unknown assignee

// Is a "DD.M.YY" due date in the past?
function isOverdue(due) {
  if (!due) return false;
  const m = due.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (!m) return false;
  let [, d, mo, y] = m;
  y = +y < 100 ? 2000 + +y : +y;
  const date = new Date(y, +mo - 1, +d);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return date < today;
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [proc, setProc] = useState([]);
  const [log, setLog] = useState([]);
  const [assemblies, setAssemblies] = useState({});
  const [projectName, setProjectName] = useState("");
  const [loaded, setLoaded] = useState(false);

  const [view, setView] = useState("board");
  const [theme, setTheme] = useState("dark");
  const [query, setQuery] = useState("");
  const [filterPerson, setFilterPerson] = useState("");
  const [filterAsm, setFilterAsm] = useState("");

  const [editing, setEditing] = useState(undefined); // undefined=closed, null=add, task=edit
  const [editingProc, setEditingProc] = useState(undefined);
  const [showMembers, setShowMembers] = useState(false);
  const [showAssemblies, setShowAssemblies] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [undo, setUndo] = useState(null);
  const importRef = useRef(null);
  const excelRef = useRef(null);
  const [excelImport, setExcelImport] = useState(null); // { tasks, procurement } pending replace/merge choice
  const undoTimer = useRef(null);
  const undoRef = useRef(null);
  const docBusyRef = useRef(false);
  const postponeRef = useRef({ id: null, count: 0, ts: 0 }); // escalating postpone (day → week)
  const [docBusy, setDocBusy] = useState(false);
  useEffect(() => { undoRef.current = undo; }, [undo]);

  // Ctrl/Cmd+Z triggers the pending undo (unless typing in a field, where the
  // browser's native text-undo should win).
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        const el = e.target;
        const tag = (el?.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select" || el?.isContentEditable) return;
        if (undoRef.current) { e.preventDefault(); doUndo(); }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---------- load / persist ----------
  useEffect(() => {
    const t = loadJSON(STORE.tasks, SEED);
    const m = loadJSON(STORE.members, DEFAULT_MEMBERS);
    const asm = loadJSON(STORE.assemblies, ASSEMBLIES);
    setTasks(t.map((x) => ({ attachments: [], comments: [], checklist: [], tags: [], ...x })));
    setMembers(m.map((x) => ({ isController: false, ...x })));
    setProc(loadJSON(STORE.procurement, PROC_SEED).map((x) => ({ attachments: [], ...x })));
    setLog(loadJSON(STORE.audit, []));
    setAssemblies(asm);
    setProjectName(loadJSON(STORE.project, ""));
    setTheme(loadJSON("mc:ui:theme", "dark"));
    setFilterPerson(m[0]?.name || "");
    setFilterAsm(Object.keys(asm)[1] || Object.keys(asm)[0] || "");
    setLoaded(true);
  }, []);

  useEffect(() => { if (loaded) saveJSON(STORE.tasks, tasks); }, [tasks, loaded]);
  useEffect(() => { if (loaded) saveJSON(STORE.members, members); }, [members, loaded]);
  useEffect(() => { if (loaded) saveJSON(STORE.procurement, proc); }, [proc, loaded]);
  useEffect(() => { if (loaded) saveJSON(STORE.audit, log); }, [log, loaded]);
  useEffect(() => { if (loaded) saveJSON(STORE.assemblies, assemblies); }, [assemblies, loaded]);
  useEffect(() => { if (loaded) saveJSON(STORE.project, projectName); }, [projectName, loaded]);
  // Apply the theme to <html> (so portals/modals get it too) and persist it.
  useEffect(() => {
    document.documentElement.classList.toggle("mc-light", theme === "light");
    if (loaded) saveJSON("mc:ui:theme", theme);
  }, [theme, loaded]);

  // ---------- audit ----------
  function record(action, detail) {
    setLog((l) => [{ ts: new Date().toISOString(), action, detail }, ...l].slice(0, 500));
  }

  // ---------- assemblies (מכלול) ----------
  // Ensure an assembly name exists in the managed list, assigning a color.
  function ensureAssembly(name) {
    const n = (name || "").trim();
    if (!n) return;
    setAssemblies((prev) => {
      if (prev[n]) return prev;
      record("נוסף מכלול", n);
      return { ...prev, [n]: unusedColor(Object.values(prev)) };
    });
  }
  function changeAssemblies(next, evt) {
    setAssemblies(next);
    if (evt?.type === "add") record("נוסף מכלול", evt.name);
    if (evt?.type === "remove") record("הוסר מכלול", evt.name);
    if (evt?.type === "rename") {
      setTasks((prev) => prev.map((t) => (t.asm === evt.from ? { ...t, asm: evt.to } : t)));
      record("שונה מכלול", `"${evt.from}" → "${evt.to}"`);
    }
  }

  // ---------- task CRUD ----------
  function saveTask(draft) {
    if (draft.asm) ensureAssembly(draft.asm);
    if (draft.id == null) {
      const id = Math.max(0, ...tasks.map((t) => t.id)) + 1;
      const now = new Date().toISOString();
      const task = { id, ...draft, createdAt: now, updatedAt: now };
      setTasks((prev) => [...prev, task]);
      record("נוספה משימה", `"${task.task}" · ${task.asm} · ${task.who || "ללא משויך"}`);
    } else {
      const before = tasks.find((t) => t.id === draft.id);
      const changes = [];
      for (const k of Object.keys(FIELD_LABELS)) {
        if (ARRAY_FIELDS.has(k)) {
          const a0 = before?.[k]?.length || 0, a1 = draft[k]?.length || 0;
          if (a0 !== a1) changes.push(`${FIELD_LABELS[k]}: ${a0}→${a1}`);
        } else if ((before?.[k] || "") !== (draft[k] || "")) {
          changes.push(`${FIELD_LABELS[k]}: "${before?.[k] || "—"}"→"${draft[k] || "—"}"`);
        }
      }
      setTasks((prev) => prev.map((t) => (t.id === draft.id ? { ...t, ...draft, updatedAt: changes.length ? new Date().toISOString() : t.updatedAt } : t)));
      if (changes.length) record("עודכנה משימה", `"${draft.task}" · ${changes.join(" · ")}`);
    }
    setEditing(undefined);
  }

  function deleteTask(task) {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    record("נמחקה משימה", `"${task.task}"`);
    setEditing(undefined);
    // Re-add the exact task (keeps attachments/comments/etc.) on undo.
    showUndo(`"${task.task}" נמחקה`, () => {
      setTasks((prev) => (prev.some((t) => t.id === task.id) ? prev : [...prev, task]));
      record("שוחזרה משימה", `"${task.task}"`);
    });
  }

  // Lightweight field patch (used by the agenda quick-actions).
  function patchTask(id, fields, detail) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...fields } : t)));
    if (detail) record("עודכנה משימה", detail);
  }

  // Undo snackbar (also triggered by Ctrl+Z). `restore` is a closure that
  // reverts the action — works for edits, completes, reschedules and deletes.
  function showUndo(msg, restore) {
    setUndo({ msg, restore });
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 7000);
  }
  function doUndo() {
    const u = undoRef.current;
    if (!u) return;
    u.restore();
    clearTimeout(undoTimer.current);
    setUndo(null);
  }
  const restoreTask = (t) => () => {
    setTasks((prev) => prev.map((x) => (x.id === t.id ? t : x)));
    record("בוטל שינוי", `"${t.task}"`);
  };
  function agendaComplete(t) {
    patchTask(t.id, { status: "בוצע" }, `"${t.task}" · הושלמה`);
    showUndo(`"${t.task}" — הושלמה`, restoreTask(t));
  }
  function agendaReschedule(t, due) {
    patchTask(t.id, { due }, `"${t.task}" · תג״ב → ${due || "—"}`);
    showUndo(`"${t.task}" — תג״ב ${due || "הוסר"}`, restoreTask(t));
  }
  // Postpone always moves the due date FORWARD (never resets to a fixed
  // "tomorrow", so far-future tasks aren't pulled backwards). Consecutive
  // swipes on the same task escalate: 1st = +1 day, then +1 week each.
  const onPostpone = (t) => {
    const now = Date.now();
    const p = postponeRef.current;
    const consecutive = p.id === t.id && now - p.ts < 12000;
    const count = consecutive ? p.count + 1 : 1;
    postponeRef.current = { id: t.id, count, ts: now };
    const cur = dueToDate(t.due);
    const today = startOfToday();
    const base = cur && cur >= today ? cur : today;
    const step = count >= 2 ? 7 : 1; // first swipe a day, consecutive swipes a week
    agendaReschedule(t, dateToDue(addDays(base, step)));
  };
  // Drag a card to another status column.
  function moveTaskStatus(id, status) {
    const t = tasks.find((x) => x.id === id);
    if (!t || t.status === status) return;
    patchTask(id, { status }, `"${t.task}" · סטטוס → "${status}"`);
    showUndo(`"${t.task}" → ${status}`, restoreTask(t));
  }

  // ---------- members ----------
  function changeMembers(next, evt) {
    setMembers(next);
    if (evt?.type === "add") record("נוסף חבר צוות", evt.name);
    if (evt?.type === "remove") record("הוסר חבר צוות", evt.name);
    if (evt?.type === "rename") {
      setTasks((prev) => prev.map((t) => ({
        ...t,
        who: t.who === evt.from ? evt.to : t.who,
        ctrl: t.ctrl === evt.from ? evt.to : t.ctrl,
      })));
      record("שונה חבר צוות", `"${evt.from}" → "${evt.to}"`);
    }
  }

  // ---------- procurement ----------
  function saveProc(draft) {
    if (draft.id == null) {
      const id = Math.max(0, ...proc.map((p) => p.id)) + 1;
      const row = { id, ...draft };
      setProc((prev) => [...prev, row]);
      record("נוסף פריט רכש", `"${row.item}"${row.supplier ? " · " + row.supplier : ""}`);
    } else {
      const before = proc.find((p) => p.id === draft.id);
      setProc((prev) => prev.map((p) => (p.id === draft.id ? { ...p, ...draft } : p)));
      if (before && before.status !== draft.status) record("עודכן רכש", `"${draft.item}" · סטטוס: "${before.status}"→"${draft.status}"`);
      else record("עודכן רכש", `"${draft.item}"`);
    }
    setEditingProc(undefined);
  }

  function deleteProc(row) {
    setProc((prev) => prev.filter((p) => p.id !== row.id));
    record("נמחק פריט רכש", `"${row.item}"`);
    setEditingProc(undefined);
  }

  // ---------- backup ----------
  function exportBackup() {
    const payload = { v: 2, tasks, members, proc, log, assemblies, projectName, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safe = (projectName || "mission-control").trim().replace(/[\\/:*?"<>|]/g, "-");
    a.href = url; a.download = `${safe}-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  }

  // Clear demo/old data to start a fresh project. Keeps members + assemblies
  // (the reusable team/structure); wipes tasks, procurement and the audit log.
  // Export-first prompt, single confirm, undo-backed.
  function newProject() {
    if (!tasks.length && !proc.length) { alert("אין נתונים לניקוי."); return; }
    if (confirm("מומלץ לייצא גיבוי לפני ניקוי הנתונים. לייצא גיבוי עכשיו?")) exportBackup();
    if (!confirm("לנקות את כל המשימות, הרכש והיומן ולהתחיל פרויקט חדש? חברי הצוות והמכלולים יישמרו.")) return;
    const snap = { tasks, proc, log };
    setTasks([]); setProc([]); setLog([]);
    record("פרויקט חדש", "נוקו משימות, רכש ויומן");
    showUndo("הנתונים נוקו", () => {
      setTasks(snap.tasks); setProc(snap.proc); setLog(snap.log);
    });
  }

  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try { data = JSON.parse(reader.result); } catch { alert("קובץ גיבוי לא תקין."); return; }
      if (!Array.isArray(data.tasks) && !Array.isArray(data.members)) { alert("קובץ גיבוי לא תקין."); return; }
      if (!confirm("ייבוא הגיבוי יחליף את כל הנתונים הקיימים בפרויקט זה. להמשיך?")) return;
      if (Array.isArray(data.tasks)) setTasks(data.tasks.map((x) => ({ attachments: [], comments: [], checklist: [], tags: [], ...x })));
      if (Array.isArray(data.members)) setMembers(data.members.map((x) => ({ isController: false, ...x })));
      if (Array.isArray(data.proc)) setProc(data.proc);
      if (Array.isArray(data.log)) setLog(data.log);
      if (data.assemblies && typeof data.assemblies === "object") setAssemblies(data.assemblies);
      if (typeof data.projectName === "string") setProjectName(data.projectName);
      record("יובא גיבוי", `${data.tasks?.length || 0} משימות`);
      alert("הגיבוי יובא. שים לב: קבצים/תמונות מצורפים אינם כלולים בגיבוי טקסט זה.");
    };
    reader.readAsText(file);
  }

  // ---------- Excel (web) ----------
  function exportExcelWeb() {
    excelWeb.exportXlsx({ tasks, procurement: proc, projectName }).catch((e) => alert("ייצוא נכשל: " + e.message));
  }
  function downloadTemplateWeb() {
    excelWeb.templateXlsx({ assemblies: Object.keys(assemblies), members: members.map((m) => m.name), projectName })
      .catch((e) => alert("הורדת התבנית נכשלה: " + e.message));
  }
  async function importExcelWebFile(file) {
    let data;
    try { data = await excelWeb.importXlsx(file); }
    catch (e) { alert("הייבוא נכשל: " + e.message); return; }
    if (!data.tasks.length && !data.procurement.length) { alert('לא נמצאו שורות לייבוא. ודאו שהקובץ תואם לתבנית (גיליון "משימות").'); return; }
    setExcelImport(data); // open the replace/merge choice modal
  }
  function applyExcelImport(replace) {
    const data = excelImport;
    if (!data) return;
    const existingTasks = replace ? [] : tasks;
    let tid = Math.max(0, ...existingTasks.map((t) => t.id || 0)) + 1;
    const newTasks = data.tasks.map((t) => ({
      id: tid++, asm: t.asm || "", task: t.task, pri: t.pri, status: t.status,
      who: t.who || "", ctrl: t.ctrl || "", due: t.due || "", notes: t.notes || "",
      tags: t.tags || [], checklist: [], comments: [], attachments: [],
    }));
    setTasks([...existingTasks, ...newTasks]);
    const existingProc = replace ? [] : proc;
    let pid = Math.max(0, ...existingProc.map((p) => p.id || 0)) + 1;
    setProc([...existingProc, ...data.procurement.map((p) => ({ id: pid++, ...p }))]);
    setAssemblies((prev) => {
      const next = { ...prev };
      for (const t of newTasks) { const a = (t.asm || "").trim(); if (a && !next[a]) next[a] = unusedColor(Object.values(next)); }
      return next;
    });
    // Add any new people from the מבצע/בקר columns to the team list.
    setMembers((prev) => {
      const have = new Set(prev.map((m) => m.name));
      const next = [...prev];
      for (const t of newTasks) {
        for (const name of [t.who, t.ctrl]) {
          const n = (name || "").trim();
          if (n && !have.has(n)) {
            have.add(n);
            next.push({ id: "m_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: n, color: MEMBER_PALETTE[next.length % MEMBER_PALETTE.length], isController: false });
          }
        }
      }
      return next;
    });
    record(replace ? "יובא מ-Excel (החלפה)" : "יובא מ-Excel (הוספה)", `${newTasks.length} משימות · ${data.procurement.length} רכש`);
    setExcelImport(null);
  }

  // ---------- status report document (for management) ----------
  // A periodic, presentation-ready status doc covering ALL statuses:
  // blockers (תקוע) first, then in-progress, in-review, completed.
  function exportDevSummary() {
    const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const pname = (projectName || "").trim();
    const today = new Date().toLocaleDateString("he-IL", { day: "2-digit", month: "long", year: "numeric" });
    const overdueCount = tasks.filter((t) => isOverdue(t.due) && t.status !== "בוצע").length;

    // Order sections for management readability: blockers → in-progress → review → done.
    const REPORT_ORDER = ["תקוע", "בעבודה", "לבדיקה", "בוצע"];
    const LABELS = { "תקוע": "תקועים / חוסמים", "בעבודה": "בעבודה כעת", "לבדיקה": "ממתינות לבדיקה", "בוצע": "הושלמו" };

    const taskRow = (t, status) => {
      const overdue = isOverdue(t.due) && status !== "בוצע";
      const chk = t.checklist?.length ? ` · תת-משימות: ${t.checklist.filter((c) => c.done).length}/${t.checklist.length}` : "";
      const tags = t.tags?.length ? `<div class="tags">${t.tags.map((x) => `<span class="tag">${esc(x)}</span>`).join("")}</div>` : "";
      const ac = asmColor(assemblies, t.asm);
      return `<div class="task">
        <div class="row1"><span class="asm" style="background:${ac};color:${readable(ac)}">${esc(t.asm)}</span><span class="ttl">${esc(t.task)}</span></div>
        <div class="meta">מבצע: <b>${esc(t.who || "—")}</b>${t.ctrl ? ` · בקר: ${esc(t.ctrl)}` : ""}${t.due ? ` · תג״ב: <span class="${overdue ? "od" : ""}">${esc(t.due)}${overdue ? " ⚠" : ""}</span>` : ""}${chk}</div>
        ${t.notes ? `<div class="notes">${esc(t.notes)}</div>` : ""}
        ${tags}
      </div>`;
    };

    const sections = REPORT_ORDER.map((status) => {
      const items = tasks.filter((t) => t.status === status);
      if (!items.length) return "";
      const c = STATUSES[status].color;
      return `<h2 class="status" style="border-color:${c}"><span class="sdot" style="background:${c}"></span>${esc(LABELS[status])} <span class="muted">(${items.length})</span></h2>
        ${items.map((t) => taskRow(t, status)).join("")}`;
    }).join("");

    const summaryChips = `<span class="chip"><b>${tasks.length}</b> סה״כ</span>` +
      STATUS_ORDER.map((s) => `<span class="chip"><b style="color:${STATUSES[s].color}">${counts[s]}</b> ${esc(s)}</span>`).join("");

    const attention = (counts["תקוע"] || overdueCount)
      ? `<div class="attn"><b>נקודות לתשומת לב:</b> ${counts["תקוע"] ? `${counts["תקוע"]} משימות תקועות/חוסמות` : ""}${counts["תקוע"] && overdueCount ? " · " : ""}${overdueCount ? `${overdueCount} משימות באיחור תג״ב` : ""}.</div>`
      : "";

    const html = `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<title>דוח סטטוס פרויקט${pname ? ` — ${esc(pname)}` : ""}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;800&display=swap');
  body{font-family:'Heebo',system-ui,sans-serif;max-width:840px;margin:40px auto;padding:0 20px;color:#1a1f29;line-height:1.55}
  h1{font-size:26px;margin:0 0 4px}
  h2.status{font-size:17px;margin:26px 0 12px;display:flex;align-items:center;gap:9px;border-right:4px solid;padding:2px 10px 6px 0}
  .sdot{width:10px;height:10px;border-radius:50%;display:inline-block}
  .meta-top{color:#6b7686;font-size:13px;margin-bottom:14px}
  .chips{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}
  .chip{border:1px solid #e3e7ee;border-radius:20px;padding:4px 12px;font-size:13px}
  .attn{background:#fff5f5;border:1px solid #f3c9c9;border-radius:10px;padding:10px 13px;font-size:13px;color:#7a2e2e;margin:8px 0 4px}
  .asm{font-size:11.5px;font-weight:700;padding:2px 9px;border-radius:20px;flex-shrink:0}
  .task{border:1px solid #e8ebf1;border-radius:10px;padding:11px 13px;margin-bottom:9px}
  .row1{display:flex;align-items:center;gap:9px}
  .ttl{font-weight:600;font-size:14.5px} .meta{color:#5a6473;font-size:12.5px;margin-top:5px}
  .od{color:#c0392b;font-weight:700}
  .notes{font-size:12.5px;color:#3b4351;margin-top:6px;white-space:pre-wrap;background:#f7f8fa;border-radius:7px;padding:7px 9px}
  .tags{margin-top:7px;display:flex;flex-wrap:wrap;gap:5px}
  .tag{font-size:11px;background:#eef1f6;border-radius:20px;padding:1px 8px;color:#4a5365}
  .muted{color:#8b97a8} @media print{body{margin:0} .task{break-inside:avoid}}
</style></head><body>
  <h1>דוח סטטוס פרויקט${pname ? ` — ${esc(pname)}` : ""}</h1>
  <div class="meta-top">${pname ? esc(pname) + " · " : ""}מרכז בקרת משימות · הופק בתאריך ${today} · ${tasks.length} משימות · ${counts["בוצע"]} הושלמו</div>
  <div class="chips">${summaryChips}</div>
  ${attention}
  ${sections || '<p class="muted">אין משימות.</p>'}
  <p class="muted" style="margin-top:30px;font-size:12px">להמרה ל-PDF / מצגת: פתחו את הקובץ בדפדפן והדפיסו (Ctrl/Cmd+P) → שמירה כ-PDF.</p>
</body></html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = (pname || "מרכז-משימות").replace(/[\\/:*?"<>|]/g, "-");
    a.href = url; a.download = `דוח-סטטוס-${safeName}-${new Date().toISOString().slice(0, 10)}.html`;
    a.click(); URL.revokeObjectURL(url);
    record("הופק דוח סטטוס", `${tasks.length} משימות · ${counts["תקוע"]} תקועות`);
  }

  // Full project documentation: a ZIP containing report.html (with images
  // embedded inline) plus every non-image attachment (PDF, CAD, BOM, …) as a
  // real file under files/, linked from the report. Big docs stay out of the
  // HTML so it remains a viewable single page.
  async function exportDocumentation() {
    if (docBusyRef.current) return;
    docBusyRef.current = true;
    setDocBusy(true);
    try {
      const { default: JSZip } = await import("jszip");
      const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
      const pname = (projectName || "").trim();
      const today = new Date().toLocaleDateString("he-IL", { day: "2-digit", month: "long", year: "numeric" });
      const zip = new JSZip();
      const usedNames = new Set();
      const blobToDataURL = (blob) => new Promise((res, rej) => {
        const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob);
      });

      let imgCount = 0, docCount = 0;
      async function attachmentsHtml(t) {
        const atts = t.attachments || [];
        let imgs = "", docs = "";
        for (const a of atts) {
          let blob;
          try { blob = await getBlob(a.id); } catch { blob = null; }
          if (!blob) continue;
          if (a.kind === "image") {
            const dataUrl = await blobToDataURL(blob);
            imgs += `<a href="${dataUrl}" target="_blank"><img class="att" src="${dataUrl}" alt="${esc(a.name)}" title="${esc(a.name)}"></a>`;
            imgCount++;
          } else {
            let base = (a.name || a.id).replace(/[\\/:*?"<>|]/g, "_");
            let fn = base, i = 1;
            while (usedNames.has(fn)) {
              const dot = base.lastIndexOf(".");
              fn = dot > 0 ? `${base.slice(0, dot)} (${i})${base.slice(dot)}` : `${base} (${i})`;
              i++;
            }
            usedNames.add(fn);
            zip.file(`files/${fn}`, await blob.arrayBuffer());
            docs += `<a class="doc" href="files/${encodeURIComponent(fn)}">📎 ${esc(a.name)}<span class="docsz">${(a.size / 1024 / 1024 >= 1 ? (a.size / 1024 / 1024).toFixed(1) + " MB" : Math.max(1, Math.round(a.size / 1024)) + " KB")}</span></a>`;
            docCount++;
          }
        }
        let html = "";
        if (imgs) html += `<div class="atts">${imgs}</div>`;
        if (docs) html += `<div class="docs">${docs}</div>`;
        return html;
      }

      const DOC_ORDER = ["תקוע", "בעבודה", "לבדיקה", "בוצע"];
      let body = "";
      for (const st of DOC_ORDER) {
        const items = tasks.filter((t) => t.status === st);
        if (!items.length) continue;
        const sc = STATUSES[st].color;
        body += `<h2 class="status" style="border-color:${sc}"><span class="sdot" style="background:${sc}"></span>${esc(st)} <span class="n">${items.length}</span></h2>`;
        for (const t of items) {
          const ac = asmColor(assemblies, t.asm);
          const meta = [
            t.who && `מבצע: ${esc(t.who)}`, t.ctrl && `בקר: ${esc(t.ctrl)}`,
            `עדיפות: ${esc(t.pri)}`, t.due && `תג״ב: ${esc(t.due)}`,
          ].filter(Boolean).join(" · ");
          const checklist = (t.checklist || []).length
            ? `<ul class="chk">${t.checklist.map((c) => `<li class="${c.done ? "done" : ""}">${c.done ? "✓" : "▢"} ${esc(c.text)}</li>`).join("")}</ul>` : "";
          const comments = (t.comments || []).length
            ? `<div class="cmts">${t.comments.map((c) => `<div class="cmt">${esc(c.text)}</div>`).join("")}</div>` : "";
          const atts = await attachmentsHtml(t);
          body += `<div class="task">
            <div class="row1">
              ${t.asm ? `<span class="asm" style="background:${ac};color:${readable(ac)}">${esc(t.asm)}</span>` : ""}
              <span class="ttl">${esc(t.task)}</span>
            </div>
            ${meta ? `<div class="meta">${meta}</div>` : ""}
            ${t.notes ? `<div class="notes">${esc(t.notes)}</div>` : ""}
            ${checklist}${comments}${atts}
          </div>`;
        }
      }
      if (!body) body = '<p class="muted">אין משימות.</p>';

      const html = `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8">
<title>תיעוד פרויקט${pname ? ` — ${esc(pname)}` : ""}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;800&display=swap');
  body{font-family:'Heebo',system-ui,sans-serif;max-width:880px;margin:40px auto;padding:0 20px;color:#1a1f29;line-height:1.55}
  h1{font-size:26px;margin:0 0 4px} .meta-top{color:#6b7686;font-size:13px;margin-bottom:18px}
  h2.status{font-size:17px;margin:26px 0 12px;display:flex;align-items:center;gap:9px;border-right:4px solid;padding:2px 10px 6px 0}
  .sdot{width:10px;height:10px;border-radius:50%;display:inline-block} .n{color:#8b97a8;font-size:13px;font-weight:400}
  .task{border:1px solid #e8ebf1;border-radius:10px;padding:12px 14px;margin-bottom:11px}
  .row1{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
  .asm{font-size:11.5px;font-weight:700;padding:2px 9px;border-radius:20px}
  .ttl{font-weight:600;font-size:15px} .meta{color:#5a6473;font-size:12.5px;margin-top:6px}
  .notes{font-size:12.5px;color:#3b4351;margin-top:8px;white-space:pre-wrap;background:#f7f8fa;border-radius:7px;padding:8px 10px}
  ul.chk{margin:8px 0 0;padding:0;list-style:none;font-size:12.5px;color:#3b4351} ul.chk li{padding:1px 0} ul.chk li.done{color:#8b97a8;text-decoration:line-through}
  .cmts{margin-top:8px;display:flex;flex-direction:column;gap:5px} .cmt{font-size:12px;color:#4a5365;background:#eef1f6;border-radius:7px;padding:6px 9px}
  .atts{margin-top:10px;display:flex;flex-wrap:wrap;gap:8px}
  img.att{max-width:200px;max-height:200px;border-radius:8px;border:1px solid #e3e7ee;object-fit:cover}
  .docs{margin-top:9px;display:flex;flex-direction:column;gap:5px}
  a.doc{font-size:12.5px;color:#1f6feb;text-decoration:none;display:flex;align-items:center;gap:7px} a.doc:hover{text-decoration:underline}
  .docsz{color:#8b97a8;font-size:11px;font-family:monospace} .muted{color:#8b97a8}
  @media print{body{margin:0} .task{break-inside:avoid}}
</style></head><body>
  <h1>תיעוד פרויקט${pname ? ` — ${esc(pname)}` : ""}</h1>
  <div class="meta-top">${pname ? esc(pname) + " · " : ""}הופק בתאריך ${today} · ${tasks.length} משימות · ${imgCount} תמונות · ${docCount} מסמכים מצורפים</div>
  ${body}
  <p class="muted" style="margin-top:30px;font-size:12px">התמונות מוטמעות בקובץ. המסמכים (PDF, CAD וכו׳) נמצאים בתיקיית <b>files</b> שליד קובץ זה. להמרה ל-PDF: פתחו בדפדפן והדפיסו (Ctrl/Cmd+P).</p>
</body></html>`;

      zip.file("report.html", html);
      const safe = (pname || "מרכז-משימות").replace(/[\\/:*?"<>|]/g, "-");
      const out = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(out);
      const a = document.createElement("a");
      a.href = url; a.download = `תיעוד-${safe}-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      record("הופק תיעוד פרויקט", `${tasks.length} משימות · ${imgCount} תמונות · ${docCount} מסמכים`);
    } catch (e) {
      alert("הפקת התיעוד נכשלה: " + (e?.message || e));
    } finally {
      docBusyRef.current = false;
      setDocBusy(false);
    }
  }

  // ---------- derived ----------
  const counts = useMemo(
    () => STATUS_ORDER.reduce((a, s) => ((a[s] = tasks.filter((t) => t.status === s).length), a), {}),
    [tasks]
  );
  const taskCounts = useMemo(() => {
    const c = {};
    for (const t of tasks) c[t.who] = (c[t.who] || 0) + 1;
    return c;
  }, [tasks]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) =>
      [t.task, t.notes, t.who, t.ctrl, t.asm, ...(t.tags || [])].some((v) => (v || "").toLowerCase().includes(q)));
  }, [tasks, query]);

  const tagSuggestions = useMemo(
    () => [...new Set(tasks.flatMap((t) => t.tags || []))].sort(),
    [tasks]
  );

  const memberNames = members.map((m) => m.name);

  if (!loaded) return <div style={S.boot}>טוען את מרכז הבקרה…</div>;

  return (
    <div dir="rtl" style={S.app}>
      <style>{CSS}</style>

      {/* compact header */}
      <header style={S.head}>
        <div style={S.titleRow}>
          <div style={S.crest}>◆</div>
          <div style={{ minWidth: 0 }}>
            <div style={S.titleLine}>
              <h1 style={S.h1}>מרכז בקרת משימות</h1>
              <span style={S.titleSep}>·</span>
              <input style={S.projectInput} value={projectName} placeholder="+ שם פרויקט"
                title="שם הפרויקט של הקובץ הנוכחי"
                onChange={(e) => setProjectName(e.target.value)} />
            </div>
            <div style={S.sub}>{tasks.length} משימות · {counts["בוצע"]} הושלמו</div>
          </div>
          <div style={S.headRight}>
            <button style={S.ghostBtn} onClick={() => setShowMembers(true)}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <circle cx="5.5" cy="5" r="2.6" /><circle cx="11.5" cy="5.5" r="2.1" />
                <path d="M1 14c0-2.5 2-4 4.5-4S10 11.5 10 14z" /><path d="M10.5 14c0-1.8.9-3.2 2.4-3.7 1.6.4 2.6 1.8 2.6 3.7z" />
              </svg>
              צוות
            </button>
            <button style={S.ghostBtn} onClick={() => setShowAssemblies(true)}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <rect x="1" y="1" width="6" height="6" rx="1.4" /><rect x="9" y="1" width="6" height="6" rx="1.4" />
                <rect x="1" y="9" width="6" height="6" rx="1.4" /><rect x="9" y="9" width="6" height="6" rx="1.4" />
              </svg>
              מכלולים
            </button>
            <button style={S.iconBtn} onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
              aria-label="מצב כהה / בהיר" title={theme === "light" ? "מעבר למצב כהה" : "מעבר למצב בהיר"}>◐</button>
            <button style={S.iconBtn} onClick={() => setShowPanel(true)} aria-label="סיכום ואפשרויות" title="סיכום ואפשרויות">⋮</button>
          </div>
        </div>
        <div style={S.controlsRow}>
          <div style={S.tabs} className="mc-tabs">
            {[["board", "משימות"], ["agenda", "לו״ז"], ["people", "איש צוות"], ["asm", "מכלול"], ["proc", "רכש"]].map(([k, l]) => (
              <button key={k} onClick={() => setView(k)} className="mc-tab"
                style={{ ...S.tab, ...(view === k ? S.tabOn : {}) }}>{l}</button>
            ))}
          </div>
          <input style={S.search} value={query} placeholder="חיפוש…"
            onChange={(e) => setQuery(e.target.value)} />
          <input ref={excelRef} type="file" accept=".xlsx" hidden
            onChange={(e) => { if (e.target.files[0]) importExcelWebFile(e.target.files[0]); e.target.value = ""; }} />
          <input ref={importRef} type="file" accept="application/json" hidden
            onChange={(e) => { if (e.target.files[0]) importBackup(e.target.files[0]); e.target.value = ""; }} />
        </div>
      </header>

      {/* body */}
      <div style={S.body}>
        <main style={S.main}>
          {view === "board" && (
            <BoardColumns items={filtered} members={members} assemblies={assemblies}
              onPick={setEditing} onMove={moveTaskStatus} />
          )}

          {view === "people" && (
            <FilterView label="איש צוות" options={[...memberNames, UNASSIGNED]} value={filterPerson} onChange={setFilterPerson}
              items={filtered.filter((t) => filterPerson === UNASSIGNED ? (!t.who || !memberNames.includes(t.who)) : t.who === filterPerson)}
              members={members} assemblies={assemblies}
              onPick={setEditing} onComplete={agendaComplete} onPostpone={onPostpone} onMove={moveTaskStatus} />
          )}
          {view === "asm" && (
            <AssemblyGroups tasks={filtered} assemblies={assemblies} members={members} onPick={setEditing} />
          )}
          {view === "agenda" && (
            <AgendaView tasks={filtered} members={members} assemblies={assemblies} onPick={setEditing}
              onComplete={agendaComplete} onReschedule={agendaReschedule} onPostpone={onPostpone} />
          )}
          {view === "proc" && <ProcurementView rows={proc} query={query} onPick={setEditingProc} />}
        </main>
      </div>

      {/* context-aware add FAB */}
      {view === "proc" ? (
        <button style={S.fab} onClick={() => setEditingProc(null)} aria-label="פריט רכש חדש">
          <span style={S.fabPlus}>＋</span> פריט רכש
        </button>
      ) : (
        <button style={S.fab} onClick={() => setEditing(null)} aria-label="משימה חדשה">
          <span style={S.fabPlus}>＋</span> משימה חדשה
        </button>
      )}

      {/* modals */}
      {editing !== undefined && (
        <TaskModal task={editing} members={members} assemblies={assemblies} tagSuggestions={tagSuggestions}
          onSave={saveTask} onDelete={deleteTask} onClose={() => setEditing(undefined)} />
      )}
      {editingProc !== undefined && (
        <ProcurementModal row={editingProc} onSave={saveProc} onDelete={deleteProc}
          onClose={() => setEditingProc(undefined)} />
      )}
      {showMembers && (
        <MembersModal members={members} taskCounts={taskCounts}
          onChange={changeMembers} onClose={() => setShowMembers(false)} />
      )}
      {showAssemblies && (
        <AssembliesModal assemblies={assemblies} tasks={tasks}
          onChange={changeAssemblies} onClose={() => setShowAssemblies(false)} />
      )}
      {undo && (
        <div style={S.snackbar} className="snackbar-in">
          <span style={S.snackMsg}>{undo.msg}</span>
          <button style={S.snackBtn} onClick={doUndo}>↩ בטל</button>
        </div>
      )}
      {showLog && <AuditDrawer log={log} onClear={() => setLog([])} onClose={() => setShowLog(false)} />}
      {showPanel && (
        <SidePanel
          counts={counts} total={tasks.length} members={members.length}
          onDevSummary={exportDevSummary}
          onDocumentation={() => { setShowPanel(false); exportDocumentation(); }} docBusy={docBusy}
          onOpenLog={() => { setShowPanel(false); setShowLog(true); }}
          onExport={exportBackup}
          onImport={() => importRef.current?.click()}
          onExcelExport={() => { setShowPanel(false); exportExcelWeb(); }}
          onExcelImport={() => { setShowPanel(false); excelRef.current?.click(); }}
          onExcelTemplate={() => { setShowPanel(false); downloadTemplateWeb(); }}
          onNewProject={() => { setShowPanel(false); newProject(); }}
          onClose={() => setShowPanel(false)} />
      )}
      {excelImport && (
        <ImportChoiceModal data={excelImport}
          onReplace={() => applyExcelImport(true)} onMerge={() => applyExcelImport(false)}
          onCancel={() => setExcelImport(null)} />
      )}
    </div>
  );
}

function ImportChoiceModal({ data, onReplace, onMerge, onCancel }) {
  useEscape(onCancel);
  return (
    <div style={S.scrim} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div style={{ ...S.modal, maxWidth: 420 }}>
        <button style={S.close} onClick={onCancel} aria-label="סגור">×</button>
        <h2 style={S.modalTitle}>ייבוא מ-Excel</h2>
        <div style={{ fontSize: 13.5, color: "#C9D4E0", lineHeight: 1.6, marginBottom: 16 }}>
          נמצאו <b style={{ color: GOLD }}>{data.tasks.length}</b> משימות ו-<b style={{ color: GOLD }}>{data.procurement.length}</b> פריטי רכש.
          <br />כיצד לייבא?
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button style={S.primaryBtn} onClick={onReplace}>החלף הכל</button>
          <button style={{ ...S.panelBtn, justifyContent: "center", marginBottom: 0 }} onClick={onMerge}>הוסף לקיים</button>
          <button style={{ ...S.panelBtn, justifyContent: "center", marginBottom: 0, color: MUTED }} onClick={onCancel}>ביטול</button>
        </div>
        <div style={{ fontSize: 11.5, color: MUTED, marginTop: 12, lineHeight: 1.6 }}>
          "החלף הכל" ימחק את הנתונים הקיימים ויטען מחדש מהאקסל.
          <br />שים לב: קובץ Excel אינו כולל תת-משימות, הערות או קבצים מצורפים — אלה לא ייובאו.
        </div>
      </div>
    </div>
  );
}

// ============================== sub-components ==============================
function SidePanel({ counts, total, members, onDevSummary, onDocumentation, docBusy, onOpenLog, onExport, onImport, onExcelExport, onExcelImport, onExcelTemplate, onNewProject, onClose }) {
  useEscape(onClose);
  return (
    <>
      <div style={S.drawerScrim} onClick={onClose} />
      <aside style={S.drawer}>
        <div style={S.railHead}>
          סיכום ואפשרויות
          <button style={S.drawerClose} onClick={onClose} aria-label="סגור">×</button>
        </div>

        <div style={S.drawerBody}>
        <div style={S.panelSection}>
          <div style={S.panelTitle}>סיכום משימות</div>
          <div style={S.sumRow}>
            <span style={{ ...S.sumDot, background: GOLD }} /> סה״כ
            <span style={{ ...S.sumRowN, color: GOLD }}>{total}</span>
          </div>
          {STATUS_ORDER.map((s) => (
            <div key={s} style={S.sumRow}>
              <span style={{ ...S.sumDot, background: STATUSES[s].color }} /> {s}
              <span style={{ ...S.sumRowN, color: STATUSES[s].color }}>{counts[s]}</span>
            </div>
          ))}
          <div style={{ ...S.sumRow, color: MUTED, fontSize: 12 }}>חברי צוות<span style={{ ...S.sumRowN, color: MUTED, fontSize: 13 }}>{members}</span></div>
        </div>

        <div style={S.panelSection}>
          <div style={S.panelTitle}>כלים</div>
          <button style={S.panelBtn} onClick={onDevSummary}>
            <span style={S.panelBtnIcon}>📄</span>
            <span>ייצוא דוח סטטוס<div style={S.panelBtnSub}>סטטוס מלא — תקועים, בעבודה והושלמו · להפקת מצגת</div></span>
          </button>
          <button style={S.panelBtn} onClick={onDocumentation} disabled={docBusy}>
            <span style={S.panelBtnIcon}>🗂️</span>
            <span>{docBusy ? "מכין תיעוד…" : "ייצוא תיעוד פרויקט (ZIP)"}<div style={S.panelBtnSub}>דוח מלא עם תמונות מוטמעות + כל הקבצים המצורפים (PDF, CAD…) בתיקייה</div></span>
          </button>
          <button style={S.panelBtn} onClick={onOpenLog}>
            <span style={S.panelBtnIcon}>🕘</span>
            <span>יומן פעילות<div style={S.panelBtnSub}>היסטוריית שינויים</div></span>
          </button>
          <button style={S.panelBtn} onClick={onExport}>
            <span style={S.panelBtnIcon}>⬇️</span>
            <span>ייצוא גיבוי (JSON)<div style={S.panelBtnSub}>שמירת כל הנתונים לקובץ</div></span>
          </button>
          <button style={S.panelBtn} onClick={onImport}>
            <span style={S.panelBtnIcon}>⬆️</span>
            <span>ייבוא גיבוי (JSON)<div style={S.panelBtnSub}>שחזור מקובץ גיבוי</div></span>
          </button>
        </div>

        <div style={S.panelSection}>
          <div style={S.panelTitle}>Excel</div>
          <button style={S.panelBtn} onClick={onExcelImport}>
            <span style={S.panelBtnIcon}>📥</span>
            <span>ייבוא מ-Excel<div style={S.panelBtnSub}>טעינת משימות ורכש מקובץ (החלפה / הוספה)</div></span>
          </button>
          <button style={S.panelBtn} onClick={onExcelExport}>
            <span style={S.panelBtnIcon}>📊</span>
            <span>ייצוא ל-Excel<div style={S.panelBtnSub}>טבלת משימות + בקרת רכש</div></span>
          </button>
          <button style={S.panelBtn} onClick={onExcelTemplate}>
            <span style={S.panelBtnIcon}>📋</span>
            <span>הורד תבנית Excel<div style={S.panelBtnSub}>תבנית ריקה למילוי וייבוא</div></span>
          </button>
        </div>

        <div style={S.panelSection}>
          <div style={S.panelTitle}>פרויקט</div>
          <button style={S.panelBtn} onClick={onNewProject}>
            <span style={S.panelBtnIcon}>🧹</span>
            <span>פרויקט חדש / נקה נתוני דוגמה<div style={S.panelBtnSub}>מחיקת משימות, רכש ויומן · הצוות והמכלולים יישמרו · ניתן לביטול</div></span>
          </button>
        </div>

        <div style={S.panelSection}>
          <div style={S.panelHint}>אפשרויות נוספות יתווספו כאן בהמשך — דוחות, סינונים שמורים, הגדרות פרויקט ועוד.</div>
        </div>
        </div>
      </aside>
    </>
  );
}

function memberColor(members, name) {
  return members.find((m) => m.name === name)?.color || GOLD;
}

function Card({ t, members, assemblies, onClick, draggable }) {
  const ac = asmColor(assemblies, t.asm);
  const att = t.attachments?.length || 0;
  const checks = t.checklist?.length || 0;
  const checksDone = (t.checklist || []).filter((c) => c.done).length;
  const overdue = isOverdue(t.due) && t.status !== "בוצע";
  const dragProps = draggable ? {
    draggable: true,
    onDragStart: (e) => { e.dataTransfer.setData("text/plain", String(t.id)); e.dataTransfer.effectAllowed = "move"; },
  } : {};
  return (
    <div style={{ ...S.card, ...(draggable ? { cursor: "grab" } : {}) }} onClick={onClick} className="card" {...dragProps}>
      <span style={{ ...S.pri, color: PRIORITIES[t.pri], borderColor: PRIORITIES[t.pri] + "55" }}>{t.pri}</span>
      <div style={S.cardTask}>{t.task}</div>
      {!!(t.tags?.length) && (
        <div style={{ ...S.tagChips, marginBottom: 8 }}>
          {t.tags.map((tag) => {
            const c = tagColor(tag);
            return <span key={tag} style={{ ...S.cardTag, color: c, borderColor: c + "66", background: c + "1a" }}>{tag}</span>;
          })}
        </div>
      )}
      <div style={S.cardMeta}>
        <span style={{ ...S.asmPill, background: ac, color: readable(ac) }}>{t.asm}</span>
        <span style={{ ...S.ava, background: memberColor(members, t.who) }}>{initials(t.who)}</span>
        <span style={S.who}>{t.who}</span>
        {checks > 0 && <span style={S.clip}>✓ {checksDone}/{checks}</span>}
        {att > 0 && <span style={S.clip}>📎 {att}</span>}
        {(t.comments?.length || 0) > 0 && <span style={S.clip}>💬 {t.comments.length}</span>}
        {t.due && <span style={{ ...S.due, ...(overdue ? S.overdue : {}) }}>{t.due}</span>}
      </div>
    </div>
  );
}

// Kanban columns with drag-and-drop between statuses. Used by the main board
// and by the filter views' board layout.
function BoardColumns({ items, members, assemblies, onPick, onMove }) {
  const [over, setOver] = useState(null);
  // Collapsed status columns shrink to a header-only banner (count still shown,
  // cards hidden) so a heavy column like "בוצע" doesn't overload the board.
  // Persisted (UI preference) so it sticks across reloads.
  const [collapsed, setCollapsed] = useState(() => new Set(loadJSON("mc:ui:collapsedCols", [])));
  const toggle = (s) => setCollapsed((prev) => {
    const next = new Set(prev);
    next.has(s) ? next.delete(s) : next.add(s);
    saveJSON("mc:ui:collapsedCols", [...next]);
    return next;
  });
  return (
    <div style={{ ...S.board, gridTemplateColumns: `repeat(${STATUS_ORDER.length}, minmax(0,1fr))` }} className="mc-board">
      {STATUS_ORDER.map((s) => {
        const colItems = items.filter((t) => t.status === s);
        const isCollapsed = collapsed.has(s);
        return (
          <div key={s} style={{ ...S.col, ...(isCollapsed ? S.colCollapsed : {}), ...(over === s ? S.colOver : {}) }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== s) setOver(s); }}
            onDragLeave={(e) => { if (e.currentTarget === e.target) setOver(null); }}
            onDrop={(e) => { e.preventDefault(); setOver(null); const id = +e.dataTransfer.getData("text/plain"); if (id) onMove(id, s); }}>
            <div style={{ ...S.colHead, marginBottom: isCollapsed ? 0 : 11 }}>
              <span style={{ ...S.dot, background: STATUSES[s].color, boxShadow: `0 0 8px ${STATUSES[s].glow}` }} />
              {s}<span style={S.cnt}>{colItems.length}</span>
              <button style={S.colToggle} onClick={() => toggle(s)}
                title={isCollapsed ? "הרחב עמודה" : "כווץ לעמודה לבאנר"}>{isCollapsed ? "▸" : "▾"}</button>
            </div>
            {!isCollapsed && colItems.map((t) => <Card key={t.id} t={t} members={members} assemblies={assemblies} onClick={() => onPick(t)} draggable />)}
            {!isCollapsed && !colItems.length && <div style={S.empty}>—</div>}
          </div>
        );
      })}
    </div>
  );
}

function FilterView({ label, options, value, onChange, items, members, assemblies, onPick, colorMap, onComplete, onPostpone, onMove }) {
  const [layout, setLayout] = useState("list");
  const stats = STATUS_ORDER.reduce((a, s) => ((a[s] = items.filter((t) => t.status === s).length), a), {});
  // Group the list by מכלול (then status), so same-assembly tasks sit together.
  const sorted = [...items].sort((a, b) =>
    (a.asm || "").localeCompare(b.asm || "", "he") || STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));

  return (
    <div style={layout === "board" ? undefined : S.fv}>
      <div style={S.fvHead}>
        <span style={S.fvLabel}>{label}:</span>
        <select style={S.fvSelect} value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => <option key={o}>{o}</option>)}
        </select>
        <div style={S.layoutToggle}>
          <button style={{ ...S.layoutBtn, ...(layout === "list" ? S.layoutBtnOn : {}) }} onClick={() => setLayout("list")}>☰ רשימה</button>
          <button style={{ ...S.layoutBtn, ...(layout === "board" ? S.layoutBtnOn : {}) }} onClick={() => setLayout("board")}>▦ לוח</button>
        </div>
        <div style={S.fvStats} className="mc-fvstats">
          {STATUS_ORDER.map((s) => (
            <div key={s} style={S.fvStat}>
              <b style={{ color: STATUSES[s].color }}>{stats[s]}</b><span>{s}</span>
            </div>
          ))}
        </div>
      </div>

      {layout === "board" ? (
        <BoardColumns items={items} members={members} assemblies={assemblies} onPick={onPick} onMove={onMove} />
      ) : (
        <div>
          {sorted.map((t) => {
            const overdue = isOverdue(t.due) && t.status !== "בוצע";
            const c = asmColor(colorMap || assemblies, t.asm);
            return (
              <SwipeRow key={t.id} rowStyle={{ ...S.qrow, marginBottom: 0 }}
                onComplete={() => onComplete?.(t)} onPostpone={() => onPostpone?.(t)} onClick={() => onPick(t)}>
                <span style={{ ...S.qdot, background: STATUSES[t.status].color }} />
                <span style={{ ...S.qAsm, background: c, color: readable(c) }}>{t.asm}</span>
                <span style={S.qTask}>{t.task}</span>
                {(t.checklist?.length || 0) > 0 && <span style={S.clip}>✓ {t.checklist.filter((c) => c.done).length}/{t.checklist.length}</span>}
                {(t.attachments?.length || 0) > 0 && <span style={S.clip}>📎 {t.attachments.length}</span>}
                {(t.comments?.length || 0) > 0 && <span style={S.clip}>💬 {t.comments.length}</span>}
                {t.due && <span style={{ ...S.qDue, ...(overdue ? S.overdue : {}) }}>{t.due}</span>}
                <span style={{ ...S.pri, position: "static", color: PRIORITIES[t.pri], borderColor: PRIORITIES[t.pri] + "55" }}>{t.pri}</span>
              </SwipeRow>
            );
          })}
          {!sorted.length && <div style={S.empty}>אין משימות</div>}
        </div>
      )}
    </div>
  );
}

// מכלול tab: every assembly is a collapsible block (toggle open/close) listing
// its tasks. Open state persisted as a UI preference.
function AssemblyGroups({ tasks, assemblies, members, onPick }) {
  const [open, setOpen] = useState(() => new Set(loadJSON("mc:ui:asmOpen", [])));
  const toggle = (name) => setOpen((prev) => {
    const n = new Set(prev);
    n.has(name) ? n.delete(name) : n.add(name);
    saveJSON("mc:ui:asmOpen", [...n]);
    return n;
  });
  const groups = Object.keys(assemblies).map((name) => ({ name, color: assemblies[name], items: tasks.filter((t) => t.asm === name) }));
  const orphan = tasks.filter((t) => !t.asm || !assemblies[t.asm]);
  if (orphan.length) groups.push({ name: "— ללא מכלול —", color: "#5A6573", items: orphan });

  return (
    <div style={{ maxWidth: 820 }}>
      {groups.map((g) => {
        const isOpen = open.has(g.name);
        const doneN = g.items.filter((t) => t.status === "בוצע").length;
        return (
          <div key={g.name} style={S.asmGroup}>
            <div style={S.asmGroupHead} onClick={() => toggle(g.name)}>
              <span style={S.colToggle}>{isOpen ? "▾" : "▸"}</span>
              <span style={{ ...S.qAsm, background: g.color, color: readable(g.color), flexShrink: 0 }}>{g.name}</span>
              <span style={S.memberCount}>{g.items.length} משימות · {doneN} בוצעו</span>
            </div>
            {isOpen && (
              <div style={S.asmGroupBody}>
                {g.items.map((t) => {
                  const overdue = isOverdue(t.due) && t.status !== "בוצע";
                  return (
                    <div key={t.id} style={{ ...S.qrow, marginBottom: 6, cursor: "pointer" }} className="card" onClick={() => onPick(t)}>
                      <span style={{ ...S.qdot, background: STATUSES[t.status].color }} title={t.status} />
                      <span style={S.qTask}>{t.task}</span>
                      {(t.checklist?.length || 0) > 0 && <span style={S.clip}>✓ {t.checklist.filter((c) => c.done).length}/{t.checklist.length}</span>}
                      {(t.attachments?.length || 0) > 0 && <span style={S.clip}>📎 {t.attachments.length}</span>}
                      <span style={{ ...S.ava, width: 20, height: 20, background: memberColor(members, t.who) }}>{initials(t.who)}</span>
                      {t.due && <span style={{ ...S.qDue, ...(overdue ? S.overdue : {}) }}>{t.due}</span>}
                      <span style={{ ...S.pri, position: "static", color: PRIORITIES[t.pri], borderColor: PRIORITIES[t.pri] + "55" }}>{t.pri}</span>
                    </div>
                  );
                })}
                {!g.items.length && <div style={S.empty}>אין משימות</div>}
              </div>
            )}
          </div>
        );
      })}
      {!groups.length && <div style={S.empty}>אין מכלולים. הוסף מכלול דרך הכפתור בכותרת.</div>}
    </div>
  );
}

function ProcurementView({ rows, query, onPick }) {
  const q = query.trim().toLowerCase();
  const items = q
    ? rows.filter((r) => [r.item, r.supplier, r.notes].some((v) => (v || "").toLowerCase().includes(q)))
    : rows;
  // Sort by procurement status (להזמין first ... הגיע last).
  const sorted = [...items].sort((a, b) => PROC_STATUS_ORDER.indexOf(a.status) - PROC_STATUS_ORDER.indexOf(b.status));
  return (
    <div>
      <div style={S.procHeadRow}>
        <span>פריט</span><span>ספק</span><span>סטטוס</span><span>הוזמן</span><span>צפי הגעה</span><span style={{ textAlign: "end" }}>עלות</span>
      </div>
      <div style={S.procTable}>
        {sorted.map((r) => (
          <div key={r.id} style={S.procRow} className="card" onClick={() => onPick(r)}>
            <span style={S.procItem}>{r.item}{(r.attachments?.length || 0) > 0 && <span style={{ ...S.clip, marginInlineStart: 6 }}>📎 {r.attachments.length}</span>}</span>
            <span style={S.procCell}>{r.supplier || "—"}</span>
            <span style={{ ...S.procStatus, background: PROC_STATUSES[r.status], color: readable(PROC_STATUSES[r.status]) }}>{r.status}</span>
            <span style={S.procDate}>{r.orderDate || "—"}</span>
            <span style={S.procDate}>{r.eta || "—"}</span>
            <span style={S.procCost}>{r.cost || "—"}</span>
          </div>
        ))}
        {!sorted.length && <div style={S.empty}>אין פריטי רכש</div>}
      </div>
    </div>
  );
}

function AuditDrawer({ log, onClear, onClose }) {
  useEscape(onClose);
  return (
    <>
      <div style={S.drawerScrim} onClick={onClose} />
      <aside style={S.drawer}>
        <div style={S.railHead}>
          🕘 יומן פעילות
          <button style={{ ...S.attachBtn, marginInlineStart: "auto" }} onClick={() => { if (confirm("לנקות את היומן?")) onClear(); }}>נקה</button>
          <button style={S.drawerClose} onClick={onClose} aria-label="סגור">×</button>
        </div>
        <div style={S.drawerBody}>
          {!log.length && <div style={{ ...S.empty }}>אין רישומים עדיין.</div>}
          {log.map((e, i) => (
            <div key={i} style={S.logRow}>
              <span style={S.logTs}>{new Date(e.ts).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              <span style={S.logAction}>{e.action}</span>
              <span style={S.logDetail}>{e.detail}</span>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
