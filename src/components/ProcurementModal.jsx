import React, { useState } from "react";
import { S } from "../lib/styles.js";
import { PROC_STATUSES, PROC_STATUS_ORDER, readable } from "../lib/constants.js";
import { useEscape } from "../lib/useEscape.js";
import Attachments from "./Attachments.jsx";

function Field({ label, children }) {
  return <div style={S.field}><label style={S.fieldLabel}>{label}</label>{children}</div>;
}

const blank = () => ({ item: "", supplier: "", status: "להזמין", orderDate: "", eta: "", cost: "", notes: "", attachments: [] });

// Add/edit a procurement (בקרת רכש) item. Mirrors the original Excel sheet.
export default function ProcurementModal({ row, onSave, onDelete, onClose }) {
  const isEdit = !!row;
  const [draft, setDraft] = useState(() => (row ? { ...row } : blank()));
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  useEscape(onClose);

  function save() {
    if (!draft.item.trim()) { alert("יש להזין שם פריט."); return; }
    onSave({ ...draft, item: draft.item.trim() });
  }

  return (
    <div style={S.scrim} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <button style={S.close} onClick={onClose} aria-label="סגור">×</button>
        <div style={{ ...S.asmTag, background: PROC_STATUSES[draft.status], color: readable(PROC_STATUSES[draft.status]) }}>
          {isEdit ? "פריט רכש" : "פריט רכש חדש"}
        </div>

        <input style={S.titleInput} value={draft.item} autoFocus={!isEdit}
          placeholder="שם הפריט…" onChange={(e) => set("item", e.target.value)} />

        <div style={S.fields} className="mc-fields">
          <Field label="ספק">
            <input style={S.modalInput} value={draft.supplier} placeholder="—" onChange={(e) => set("supplier", e.target.value)} />
          </Field>
          <Field label="סטטוס">
            <select value={draft.status} onChange={(e) => set("status", e.target.value)}
              style={{ ...S.modalInput, fontWeight: 700, cursor: "pointer", color: PROC_STATUSES[draft.status] }}>
              {PROC_STATUS_ORDER.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="תאריך הזמנה">
            <input style={S.modalInput} value={draft.orderDate} placeholder="DD.M.YY" onChange={(e) => set("orderDate", e.target.value)} />
          </Field>
          <Field label="צפי הגעה">
            <input style={S.modalInput} value={draft.eta} placeholder="DD.M.YY" onChange={(e) => set("eta", e.target.value)} />
          </Field>
          <Field label="עלות">
            <input style={S.modalInput} value={draft.cost} placeholder="₪—" onChange={(e) => set("cost", e.target.value)} />
          </Field>
        </div>

        <div style={S.notesWrap}>
          <label style={S.fieldLabel}>הערות</label>
          <textarea style={S.notes} value={draft.notes} rows={2} onChange={(e) => set("notes", e.target.value)} />
        </div>

        <Attachments value={draft.attachments || []} onChange={(a) => set("attachments", a)} />

        <div style={S.modalActions}>
          <button style={S.primaryBtn} onClick={save}>{isEdit ? "שמור" : "הוסף פריט"}</button>
          {isEdit && !confirmDel && <button style={S.deleteBtn} onClick={() => setConfirmDel(true)}>מחק</button>}
        </div>

        {confirmDel && (
          <div style={S.confirmRow}>
            <span>למחוק את הפריט?</span>
            <button style={{ ...S.deleteBtn, marginInlineStart: "auto", padding: "6px 12px" }} onClick={() => onDelete(row)}>כן, מחק</button>
            <button style={S.attachBtn} onClick={() => setConfirmDel(false)}>ביטול</button>
          </div>
        )}
      </div>
    </div>
  );
}
