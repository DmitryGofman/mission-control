import React, { useState } from "react";
import { S } from "../lib/styles.js";
import { STATUSES, ASSEMBLIES, PRIORITIES, STATUS_ORDER, readable } from "../lib/constants.js";
import Attachments from "./Attachments.jsx";

function Field({ label, children }) {
  return <div style={S.field}><label style={S.fieldLabel}>{label}</label>{children}</div>;
}

function Select({ value, options, onChange, color }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      style={{ ...S.modalInput, fontWeight: 700, color: color || "#E6EDF3", cursor: "pointer" }}>
      {options.map((o) => <option key={o} value={o} style={{ color: "#111" }}>{o}</option>)}
    </select>
  );
}

const blankTask = () => ({
  asm: Object.keys(ASSEMBLIES)[0], task: "", pri: "בינוני",
  status: "בעבודה", who: "", ctrl: "", due: "", notes: "", attachments: [],
});

// One component, two modes (SPEC §5): add mode when `task` is null.
export default function TaskModal({ task, members, onSave, onDelete, onClose }) {
  const isEdit = !!task;
  const [draft, setDraft] = useState(() => (task ? { ...task } : blankTask()));
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (field, value) => setDraft((d) => ({ ...d, [field]: value }));

  const memberNames = members.map((m) => m.name);
  const whoOptions = memberNames.includes(draft.who) || !draft.who
    ? memberNames : [draft.who, ...memberNames];

  function save() {
    if (!draft.task.trim()) { alert("יש להזין שם משימה."); return; }
    onSave({ ...draft, task: draft.task.trim(), who: draft.who || memberNames[0] || "" });
  }

  return (
    <div style={S.scrim} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <button style={S.close} onClick={onClose} aria-label="סגור">×</button>
        <div style={{ ...S.asmTag, background: ASSEMBLIES[draft.asm], color: readable(ASSEMBLIES[draft.asm]) }}>
          {isEdit ? draft.asm : "משימה חדשה"}
        </div>

        <input style={S.titleInput} value={draft.task} autoFocus={!isEdit}
          placeholder="שם המשימה…" onChange={(e) => set("task", e.target.value)} />

        <div style={S.fields} className="mc-fields">
          <Field label="מכלול">
            <Select value={draft.asm} options={Object.keys(ASSEMBLIES)} onChange={(v) => set("asm", v)} />
          </Field>
          <Field label="סטטוס">
            <Select value={draft.status} options={STATUS_ORDER} onChange={(v) => set("status", v)} color={STATUSES[draft.status].color} />
          </Field>
          <Field label="עדיפות">
            <Select value={draft.pri} options={Object.keys(PRIORITIES)} onChange={(v) => set("pri", v)} color={PRIORITIES[draft.pri]} />
          </Field>
          <Field label="מי מבצע">
            <Select value={draft.who} options={whoOptions} onChange={(v) => set("who", v)} />
          </Field>
          <Field label="בקר">
            <input style={S.modalInput} value={draft.ctrl} placeholder="—"
              onChange={(e) => set("ctrl", e.target.value)} list="mc-members" />
            <datalist id="mc-members">{memberNames.map((n) => <option key={n} value={n} />)}</datalist>
          </Field>
          <Field label="תג״ב (DD.M.YY)">
            <input style={S.modalInput} value={draft.due} placeholder="—"
              onChange={(e) => set("due", e.target.value)} />
          </Field>
        </div>

        <div style={S.notesWrap}>
          <label style={S.fieldLabel}>הערות / פירוט</label>
          <textarea style={S.notes} value={draft.notes} rows={3}
            onChange={(e) => set("notes", e.target.value)} />
        </div>

        <Attachments value={draft.attachments || []} onChange={(a) => set("attachments", a)} />

        <div style={S.modalActions}>
          <button style={S.primaryBtn} onClick={save}>{isEdit ? "שמור שינויים" : "הוסף משימה"}</button>
          {isEdit && !confirmDel && (
            <button style={S.deleteBtn} onClick={() => setConfirmDel(true)}>מחק</button>
          )}
        </div>

        {confirmDel && (
          <div style={S.confirmRow}>
            <span>למחוק את המשימה?</span>
            <button style={{ ...S.deleteBtn, marginInlineStart: "auto", padding: "6px 12px" }} onClick={() => onDelete(task)}>כן, מחק</button>
            <button style={{ ...S.attachBtn }} onClick={() => setConfirmDel(false)}>ביטול</button>
          </div>
        )}
      </div>
    </div>
  );
}
