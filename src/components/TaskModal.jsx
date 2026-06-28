import React, { useState } from "react";
import { S } from "../lib/styles.js";
import { STATUSES, PRIORITIES, STATUS_ORDER, readable, initials, tagColor, asmColor, dueToISO, isoToDue } from "../lib/constants.js";
import { useEscape } from "../lib/useEscape.js";
import Attachments from "./Attachments.jsx";

function Field({ label, children }) {
  return <div style={S.field}><label style={S.fieldLabel}>{label}</label>{children}</div>;
}

function Select({ value, options, onChange, color }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      style={{ ...S.modalInput, fontWeight: 700, color: color || "#E6EDF3", cursor: "pointer" }}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

const blankTask = () => ({
  asm: "", task: "", pri: "בינוני",
  status: "בעבודה", who: "", ctrl: "", due: "", notes: "",
  attachments: [], comments: [], checklist: [], tags: [],
});

const uid = () => "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

function Checklist({ items, onChange }) {
  const [text, setText] = useState("");
  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const toggle = (id) => onChange(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));

  function add() {
    const t = text.trim();
    if (!t) return;
    onChange([...items, { id: uid(), text: t, done: false }]);
    setText("");
  }

  return (
    <div style={S.checklistWrap}>
      <label style={S.fieldLabel}>תת-משימות {items.length ? `(${done}/${items.length})` : ""}</label>
      {!!items.length && <div style={S.checkBar}><div style={{ ...S.checkBarFill, width: `${pct}%` }} /></div>}
      {items.map((i) => (
        <div key={i.id} style={S.checkItem}>
          <span style={{ ...S.checkBox, ...(i.done ? S.checkBoxOn : {}) }} onClick={() => toggle(i.id)}>{i.done ? "✓" : ""}</span>
          <span style={{ ...S.checkText, ...(i.done ? S.checkTextDone : {}) }}>{i.text}</span>
          <button type="button" style={S.commentX} onClick={() => onChange(items.filter((x) => x.id !== i.id))} aria-label="מחק">×</button>
        </div>
      ))}
      <div style={{ ...S.commentInputRow, marginTop: 8 }}>
        <input style={S.checkInput} value={text} placeholder="הוסף תת-משימה…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" style={{ ...S.attachBtn, padding: "0 14px" }} onClick={add}>הוסף</button>
      </div>
    </div>
  );
}

function Tags({ tags, suggestions, onChange }) {
  const [text, setText] = useState("");
  function add() {
    const t = text.trim();
    if (!t || tags.includes(t)) { setText(""); return; }
    onChange([...tags, t]);
    setText("");
  }
  return (
    <div style={S.tagsWrap}>
      <label style={S.fieldLabel}>תוויות</label>
      {!!tags.length && (
        <div style={{ ...S.tagChips, marginTop: 8 }}>
          {tags.map((t) => {
            const c = tagColor(t);
            return (
              <span key={t} style={{ ...S.tag, color: c, borderColor: c + "66", background: c + "1a" }}>
                {t}
                <button type="button" style={S.tagX} onClick={() => onChange(tags.filter((x) => x !== t))} aria-label="הסר">×</button>
              </span>
            );
          })}
        </div>
      )}
      <div style={{ ...S.commentInputRow, marginTop: 4 }}>
        <input style={S.checkInput} value={text} placeholder="הוסף תווית (Enter)…" list="mc-tags"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <datalist id="mc-tags">{suggestions.map((s) => <option key={s} value={s} />)}</datalist>
        <button type="button" style={{ ...S.attachBtn, padding: "0 14px" }} onClick={add}>הוסף</button>
      </div>
    </div>
  );
}

function CommentThread({ comments, members, onChange }) {
  const memberNames = members.map((m) => m.name);
  const [author, setAuthor] = useState(memberNames[0] || "");
  const [text, setText] = useState("");
  const color = (name) => members.find((m) => m.name === name)?.color || "#E8B84B";

  function add() {
    const t = text.trim();
    if (!t) return;
    onChange([...comments, { id: uid(), author: author || memberNames[0] || "—", text: t, ts: new Date().toISOString() }]);
    setText("");
  }

  return (
    <div style={S.commentsWrap}>
      <label style={{ ...S.fieldLabel, marginBottom: 9 }}>תגובות / דיון ({comments.length})</label>
      {comments.map((c) => (
        <div key={c.id} style={S.comment}>
          <span style={{ ...S.ava, background: color(c.author) }}>{initials(c.author)}</span>
          <div style={S.commentBody}>
            <div style={S.commentHead}>
              <span style={{ ...S.commentAuthor, color: color(c.author) }}>{c.author}</span>
              <span style={S.commentTs}>{new Date(c.ts).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <div style={S.commentText}>{c.text}</div>
          </div>
          <button type="button" style={S.commentX} onClick={() => onChange(comments.filter((x) => x.id !== c.id))} aria-label="מחק תגובה">×</button>
        </div>
      ))}
      <div style={S.commentInputRow}>
        <select style={S.commentSelect} value={author} onChange={(e) => setAuthor(e.target.value)}>
          {memberNames.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <input style={S.commentInput} value={text} placeholder="כתוב תגובה…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" style={{ ...S.attachBtn, padding: "0 14px" }} onClick={add}>הוסף</button>
      </div>
    </div>
  );
}

// One component, two modes (SPEC §5): add mode when `task` is null.
export default function TaskModal({ task, members, assemblies = {}, tagSuggestions = [], onSave, onDelete, onClose }) {
  const isEdit = !!task;
  const asmNames = Object.keys(assemblies);
  const [draft, setDraft] = useState(() => (task ? { ...task } : { ...blankTask(), asm: asmNames[0] || "" }));
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (field, value) => setDraft((d) => ({ ...d, [field]: value }));
  useEscape(onClose);

  const asmCol = asmColor(assemblies, draft.asm);
  const memberNames = members.map((m) => m.name);
  const whoOptions = memberNames.includes(draft.who) || !draft.who
    ? memberNames : [draft.who, ...memberNames];

  // Controllers (בקר) come from members flagged isController; fall back to all
  // members if none are flagged yet. Keep any legacy/free-text value too.
  const flagged = members.filter((m) => m.isController).map((m) => m.name);
  const ctrlBase = flagged.length ? flagged : memberNames;
  const ctrlOptions = [...new Set([...ctrlBase, ...(draft.ctrl && !ctrlBase.includes(draft.ctrl) ? [draft.ctrl] : [])])];

  function save() {
    if (!draft.task.trim()) { alert("יש להזין שם משימה."); return; }
    onSave({ ...draft, task: draft.task.trim(), who: draft.who || memberNames[0] || "" });
  }

  return (
    <div style={S.scrim} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <button style={S.close} onClick={onClose} aria-label="סגור">×</button>
        <div style={{ ...S.asmTag, background: asmCol, color: readable(asmCol) }}>
          {isEdit ? (draft.asm || "—") : "משימה חדשה"}
        </div>

        <input style={S.titleInput} value={draft.task} autoFocus={!isEdit}
          placeholder="שם המשימה…" onChange={(e) => set("task", e.target.value)} />

        <div style={S.fields} className="mc-fields">
          <Field label="מכלול">
            <input style={{ ...S.modalInput, fontWeight: 700, cursor: "text" }} value={draft.asm}
              list="mc-asm" placeholder="בחר או הקלד חדש…" onChange={(e) => set("asm", e.target.value)} />
            <datalist id="mc-asm">{asmNames.map((n) => <option key={n} value={n} />)}</datalist>
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
            <select value={draft.ctrl} onChange={(e) => set("ctrl", e.target.value)}
              style={{ ...S.modalInput, fontWeight: 700, cursor: "pointer", color: draft.ctrl ? "#E6EDF3" : "#8B97A8" }}>
              <option value="">—</option>
              {ctrlOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <Field label="תג״ב">
            <input type="date" style={S.dateInput} value={dueToISO(draft.due)}
              onChange={(e) => set("due", isoToDue(e.target.value))} />
          </Field>
        </div>

        <div style={S.notesWrap}>
          <label style={S.fieldLabel}>הערות / פירוט</label>
          <textarea style={S.notes} value={draft.notes} rows={3}
            onChange={(e) => set("notes", e.target.value)} />
        </div>

        <Tags tags={draft.tags || []} suggestions={tagSuggestions} onChange={(t) => set("tags", t)} />

        <Checklist items={draft.checklist || []} onChange={(c) => set("checklist", c)} />

        <Attachments value={draft.attachments || []} onChange={(a) => set("attachments", a)} />

        <CommentThread comments={draft.comments || []} members={members} onChange={(c) => set("comments", c)} />

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
