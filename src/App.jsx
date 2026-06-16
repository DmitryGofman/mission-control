import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  STATUSES, STATUS_ORDER, ASSEMBLIES, PRIORITIES, SEED, DEFAULT_MEMBERS,
  PROC_STATUSES, PROC_STATUS_ORDER, PROC_SEED, STORE, readable, initials, tagColor,
} from "./lib/constants.js";
import { loadJSON, saveJSON } from "./lib/storage.js";
import { useEscape } from "./lib/useEscape.js";
import { S, CSS, MUTED, GOLD } from "./lib/styles.js";
import TaskModal from "./components/TaskModal.jsx";
import MembersModal from "./components/MembersModal.jsx";
import ProcurementModal from "./components/ProcurementModal.jsx";

// Human-readable labels for audit diffs.
const FIELD_LABELS = {
  task: "שם", asm: "מכלול", pri: "עדיפות", status: "סטטוס",
  who: "מבצע", ctrl: "בקר", due: "תג״ב", notes: "הערות",
  attachments: "קבצים", checklist: "תת-משימות", tags: "תוויות", comments: "תגובות",
};
const ARRAY_FIELDS = new Set(["attachments", "checklist", "tags", "comments"]);

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
  const [loaded, setLoaded] = useState(false);

  const [view, setView] = useState("board");
  const [query, setQuery] = useState("");
  const [filterPerson, setFilterPerson] = useState("");
  const [filterAsm, setFilterAsm] = useState(Object.keys(ASSEMBLIES)[1]);

  const [editing, setEditing] = useState(undefined); // undefined=closed, null=add, task=edit
  const [editingProc, setEditingProc] = useState(undefined);
  const [showMembers, setShowMembers] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const importRef = useRef(null);

  // ---------- load / persist ----------
  useEffect(() => {
    const t = loadJSON(STORE.tasks, SEED);
    const m = loadJSON(STORE.members, DEFAULT_MEMBERS);
    setTasks(t.map((x) => ({ attachments: [], comments: [], checklist: [], tags: [], ...x })));
    setMembers(m);
    setProc(loadJSON(STORE.procurement, PROC_SEED));
    setLog(loadJSON(STORE.audit, []));
    setFilterPerson(m[0]?.name || "");
    setLoaded(true);
  }, []);

  useEffect(() => { if (loaded) saveJSON(STORE.tasks, tasks); }, [tasks, loaded]);
  useEffect(() => { if (loaded) saveJSON(STORE.members, members); }, [members, loaded]);
  useEffect(() => { if (loaded) saveJSON(STORE.procurement, proc); }, [proc, loaded]);
  useEffect(() => { if (loaded) saveJSON(STORE.audit, log); }, [log, loaded]);

  // ---------- audit ----------
  function record(action, detail) {
    setLog((l) => [{ ts: new Date().toISOString(), action, detail }, ...l].slice(0, 500));
  }

  // ---------- task CRUD ----------
  function saveTask(draft) {
    if (draft.id == null) {
      const id = Math.max(0, ...tasks.map((t) => t.id)) + 1;
      const task = { id, ...draft };
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
      setTasks((prev) => prev.map((t) => (t.id === draft.id ? { ...t, ...draft } : t)));
      if (changes.length) record("עודכנה משימה", `"${draft.task}" · ${changes.join(" · ")}`);
    }
    setEditing(undefined);
  }

  function deleteTask(task) {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    record("נמחקה משימה", `"${task.task}"`);
    setEditing(undefined);
  }

  // ---------- members ----------
  function changeMembers(next, evt) {
    setMembers(next);
    if (evt?.type === "add") record("נוסף חבר צוות", evt.name);
    if (evt?.type === "remove") record("הוסר חבר צוות", evt.name);
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
    const blob = new Blob([JSON.stringify({ tasks, members, proc, log, exportedAt: new Date().toISOString() }, null, 2)],
      { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `mission-control-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  }

  function importBackup(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (Array.isArray(data.tasks)) setTasks(data.tasks.map((x) => ({ attachments: [], comments: [], checklist: [], tags: [], ...x })));
        if (Array.isArray(data.members)) setMembers(data.members);
        if (Array.isArray(data.proc)) setProc(data.proc);
        if (Array.isArray(data.log)) setLog(data.log);
        record("יובא גיבוי", `${data.tasks?.length || 0} משימות`);
        alert("הגיבוי יובא. שים לב: קבצים/תמונות מצורפים אינם כלולים בגיבוי טקסט זה.");
      } catch { alert("קובץ גיבוי לא תקין."); }
    };
    reader.readAsText(file);
  }

  // ---------- status report document (for management) ----------
  // A periodic, presentation-ready status doc covering ALL statuses:
  // blockers (תקוע) first, then in-progress, in-review, completed.
  function exportDevSummary() {
    const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const today = new Date().toLocaleDateString("he-IL", { day: "2-digit", month: "long", year: "numeric" });
    const overdueCount = tasks.filter((t) => isOverdue(t.due) && t.status !== "בוצע").length;

    // Order sections for management readability: blockers → in-progress → review → done.
    const REPORT_ORDER = ["תקוע", "בעבודה", "לבדיקה", "בוצע"];
    const LABELS = { "תקוע": "תקועים / חוסמים", "בעבודה": "בעבודה כעת", "לבדיקה": "ממתינות לבדיקה", "בוצע": "הושלמו" };

    const taskRow = (t, status) => {
      const overdue = isOverdue(t.due) && status !== "בוצע";
      const chk = t.checklist?.length ? ` · תת-משימות: ${t.checklist.filter((c) => c.done).length}/${t.checklist.length}` : "";
      const tags = t.tags?.length ? `<div class="tags">${t.tags.map((x) => `<span class="tag">${esc(x)}</span>`).join("")}</div>` : "";
      const asmColor = ASSEMBLIES[t.asm] || "#5A6573";
      return `<div class="task">
        <div class="row1"><span class="asm" style="background:${asmColor};color:${readable(asmColor)}">${esc(t.asm)}</span><span class="ttl">${esc(t.task)}</span></div>
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
<title>דוח סטטוס פרויקט — מרכז בקרת משימות</title>
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
  <h1>דוח סטטוס פרויקט</h1>
  <div class="meta-top">מרכז בקרת משימות · הופק בתאריך ${today} · ${tasks.length} משימות · ${counts["בוצע"]} הושלמו</div>
  <div class="chips">${summaryChips}</div>
  ${attention}
  ${sections || '<p class="muted">אין משימות.</p>'}
  <p class="muted" style="margin-top:30px;font-size:12px">להמרה ל-PDF / מצגת: פתחו את הקובץ בדפדפן והדפיסו (Ctrl/Cmd+P) → שמירה כ-PDF.</p>
</body></html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `דוח-סטטוס-${new Date().toISOString().slice(0, 10)}.html`;
    a.click(); URL.revokeObjectURL(url);
    record("הופק דוח סטטוס", `${tasks.length} משימות · ${counts["תקוע"]} תקועות`);
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

      {/* header / KPI deck */}
      <header style={S.head}>
        <div style={S.titleRow}>
          <div style={S.crest}>◆</div>
          <div>
            <h1 style={S.h1}>מרכז בקרת משימות</h1>
            <div style={S.sub}>{tasks.length} משימות · {counts["בוצע"]} הושלמו · {members.length} חברי צוות</div>
          </div>
          <div style={S.headActions} className="mc-head-actions">
            <div style={S.tabs} className="mc-tabs">
              {[["board", "מפת משימות"], ["people", "לפי איש צוות"], ["asm", "לפי מכלול"], ["proc", "בקרת רכש"]].map(([k, l]) => (
                <button key={k} onClick={() => setView(k)} className="mc-tab"
                  style={{ ...S.tab, ...(view === k ? S.tabOn : {}) }}>{l}</button>
              ))}
            </div>
            <input style={S.search} value={query} placeholder="חיפוש…"
              onChange={(e) => setQuery(e.target.value)} />
            <button style={S.ghostBtn} onClick={() => setShowMembers(true)}>👥 צוות</button>
            <button style={S.iconBtn} onClick={() => setShowPanel(true)} aria-label="סיכום ואפשרויות" title="סיכום ואפשרויות">⋮</button>
            <input ref={importRef} type="file" accept="application/json" hidden
              onChange={(e) => { if (e.target.files[0]) importBackup(e.target.files[0]); e.target.value = ""; }} />
          </div>
        </div>
        <div style={S.summaryBar}>
          <span style={{ ...S.sumChip, borderColor: GOLD + "66" }}>
            <span style={{ ...S.sumN, color: GOLD }}>{tasks.length}</span> סה״כ
          </span>
          {STATUS_ORDER.map((s) => (
            <span key={s} style={S.sumChip}>
              <span style={{ ...S.sumDot, background: STATUSES[s].color }} />
              <span style={{ ...S.sumN, color: STATUSES[s].color }}>{counts[s]}</span> {s}
            </span>
          ))}
        </div>
      </header>

      {/* body */}
      <div style={S.body}>
        <main style={S.main}>
          {view === "board" && (
            <div style={S.board} className="mc-board">
              {STATUS_ORDER.map((s) => {
                const items = filtered.filter((t) => t.status === s);
                return (
                  <div key={s} style={S.col}>
                    <div style={S.colHead}>
                      <span style={{ ...S.dot, background: STATUSES[s].color, boxShadow: `0 0 8px ${STATUSES[s].glow}` }} />
                      {s}<span style={S.cnt}>{items.length}</span>
                    </div>
                    {items.map((t) => <Card key={t.id} t={t} members={members} onClick={() => setEditing(t)} />)}
                    {!items.length && <div style={S.empty}>—</div>}
                  </div>
                );
              })}
            </div>
          )}

          {view === "people" && (
            <FilterView label="איש צוות" options={memberNames} value={filterPerson} onChange={setFilterPerson}
              items={filtered.filter((t) => t.who === filterPerson)} members={members} onPick={setEditing} />
          )}
          {view === "asm" && (
            <FilterView label="מכלול" options={Object.keys(ASSEMBLIES)} value={filterAsm} onChange={setFilterAsm}
              items={filtered.filter((t) => t.asm === filterAsm)} members={members} onPick={setEditing} colorMap={ASSEMBLIES} />
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
        <TaskModal task={editing} members={members} tagSuggestions={tagSuggestions}
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
      {showLog && <AuditDrawer log={log} onClear={() => setLog([])} onClose={() => setShowLog(false)} />}
      {showPanel && (
        <SidePanel
          counts={counts} total={tasks.length} members={members.length}
          onDevSummary={exportDevSummary}
          onOpenLog={() => { setShowPanel(false); setShowLog(true); }}
          onExport={exportBackup}
          onImport={() => importRef.current?.click()}
          onClose={() => setShowPanel(false)} />
      )}
    </div>
  );
}

// ============================== sub-components ==============================
function SidePanel({ counts, total, members, onDevSummary, onOpenLog, onExport, onImport, onClose }) {
  useEscape(onClose);
  return (
    <>
      <div style={S.drawerScrim} onClick={onClose} />
      <aside style={S.drawer}>
        <div style={S.railHead}>
          סיכום ואפשרויות
          <button style={S.drawerClose} onClick={onClose} aria-label="סגור">×</button>
        </div>

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
          <div style={S.panelHint}>אפשרויות נוספות יתווספו כאן בהמשך — דוחות, סינונים שמורים, הגדרות פרויקט ועוד.</div>
        </div>
      </aside>
    </>
  );
}

function memberColor(members, name) {
  return members.find((m) => m.name === name)?.color || GOLD;
}

function Card({ t, members, onClick }) {
  const att = t.attachments?.length || 0;
  const checks = t.checklist?.length || 0;
  const checksDone = (t.checklist || []).filter((c) => c.done).length;
  const overdue = isOverdue(t.due) && t.status !== "בוצע";
  return (
    <div style={S.card} onClick={onClick} className="card">
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
        <span style={{ ...S.asmPill, background: ASSEMBLIES[t.asm], color: readable(ASSEMBLIES[t.asm]) }}>{t.asm}</span>
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

function FilterView({ label, options, value, onChange, items, members, onPick, colorMap }) {
  const stats = STATUS_ORDER.reduce((a, s) => ((a[s] = items.filter((t) => t.status === s).length), a), {});
  return (
    <div style={S.fv}>
      <div style={S.fvHead}>
        <span style={S.fvLabel}>{label}:</span>
        <select style={S.fvSelect} value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => <option key={o}>{o}</option>)}
        </select>
        <div style={S.fvStats} className="mc-fvstats">
          {STATUS_ORDER.map((s) => (
            <div key={s} style={S.fvStat}>
              <b style={{ color: STATUSES[s].color }}>{stats[s]}</b><span>{s}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        {items.map((t) => {
          const overdue = isOverdue(t.due) && t.status !== "בוצע";
          return (
            <div key={t.id} style={S.qrow} className="card" onClick={() => onPick(t)}>
              <span style={{ ...S.qdot, background: STATUSES[t.status].color }} />
              <span style={{ ...S.qAsm, background: (colorMap || ASSEMBLIES)[t.asm], color: readable((colorMap || ASSEMBLIES)[t.asm]) }}>{t.asm}</span>
              <span style={S.qTask}>{t.task}</span>
              {(t.attachments?.length || 0) > 0 && <span style={S.clip}>📎 {t.attachments.length}</span>}
              {t.due && <span style={{ ...S.qDue, ...(overdue ? S.overdue : {}) }}>{t.due}</span>}
              <span style={{ ...S.pri, position: "static", color: PRIORITIES[t.pri], borderColor: PRIORITIES[t.pri] + "55" }}>{t.pri}</span>
            </div>
          );
        })}
        {!items.length && <div style={S.empty}>אין משימות</div>}
      </div>
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
            <span style={S.procItem}>{r.item}</span>
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
