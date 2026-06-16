import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  STATUSES, STATUS_ORDER, ASSEMBLIES, PRIORITIES, SEED, DEFAULT_MEMBERS,
  PROC_STATUSES, PROC_STATUS_ORDER, PROC_SEED, STORE, readable, initials,
} from "./lib/constants.js";
import { loadJSON, saveJSON } from "./lib/storage.js";
import { S, CSS, MUTED, GOLD } from "./lib/styles.js";
import TaskModal from "./components/TaskModal.jsx";
import MembersModal from "./components/MembersModal.jsx";
import ProcurementModal from "./components/ProcurementModal.jsx";

// Human-readable labels for audit diffs.
const FIELD_LABELS = {
  task: "שם", asm: "מכלול", pri: "עדיפות", status: "סטטוס",
  who: "מבצע", ctrl: "בקר", due: "תג״ב", notes: "הערות", attachments: "קבצים",
};

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
  const importRef = useRef(null);

  // ---------- load / persist ----------
  useEffect(() => {
    const t = loadJSON(STORE.tasks, SEED);
    const m = loadJSON(STORE.members, DEFAULT_MEMBERS);
    setTasks(t.map((x) => ({ attachments: [], comments: [], ...x })));
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
        if (k === "attachments") {
          const a0 = before?.attachments?.length || 0, a1 = draft.attachments?.length || 0;
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
        if (Array.isArray(data.tasks)) setTasks(data.tasks.map((x) => ({ attachments: [], comments: [], ...x })));
        if (Array.isArray(data.members)) setMembers(data.members);
        if (Array.isArray(data.proc)) setProc(data.proc);
        if (Array.isArray(data.log)) setLog(data.log);
        record("יובא גיבוי", `${data.tasks?.length || 0} משימות`);
        alert("הגיבוי יובא. שים לב: קבצים/תמונות מצורפים אינם כלולים בגיבוי טקסט זה.");
      } catch { alert("קובץ גיבוי לא תקין."); }
    };
    reader.readAsText(file);
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
      [t.task, t.notes, t.who, t.ctrl, t.asm].some((v) => (v || "").toLowerCase().includes(q)));
  }, [tasks, query]);

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
            <button style={S.ghostBtn} onClick={() => setShowLog(true)}>🕘 יומן</button>
            <button style={S.ghostBtn} onClick={exportBackup} title="ייצוא גיבוי">⬇️</button>
            <button style={S.ghostBtn} onClick={() => importRef.current?.click()} title="ייבוא גיבוי">⬆️</button>
            <input ref={importRef} type="file" accept="application/json" hidden
              onChange={(e) => { if (e.target.files[0]) importBackup(e.target.files[0]); e.target.value = ""; }} />
          </div>
        </div>
        <div style={S.kpis} className="mc-kpis">
          <Kpi n={tasks.length} label="סה״כ" color={GOLD} />
          {STATUS_ORDER.map((s) => <Kpi key={s} n={counts[s]} label={s} color={STATUSES[s].color} />)}
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
        <TaskModal task={editing} members={members}
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
    </div>
  );
}

// ============================== sub-components ==============================
function Kpi({ n, label, color }) {
  return (
    <div style={{ ...S.kpi, borderColor: color }}>
      <div style={{ ...S.kpiN, color }}>{n}</div>
      <div style={S.kpiL}>{label}</div>
    </div>
  );
}

function memberColor(members, name) {
  return members.find((m) => m.name === name)?.color || GOLD;
}

function Card({ t, members, onClick }) {
  const att = t.attachments?.length || 0;
  const overdue = isOverdue(t.due) && t.status !== "בוצע";
  return (
    <div style={S.card} onClick={onClick} className="card">
      <span style={{ ...S.pri, color: PRIORITIES[t.pri], borderColor: PRIORITIES[t.pri] + "55" }}>{t.pri}</span>
      <div style={S.cardTask}>{t.task}</div>
      <div style={S.cardMeta}>
        <span style={{ ...S.asmPill, background: ASSEMBLIES[t.asm], color: readable(ASSEMBLIES[t.asm]) }}>{t.asm}</span>
        <span style={{ ...S.ava, background: memberColor(members, t.who) }}>{initials(t.who)}</span>
        <span style={S.who}>{t.who}</span>
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
