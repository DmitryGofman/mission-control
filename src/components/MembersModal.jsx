import React, { useRef, useState } from "react";
import { S, MUTED } from "../lib/styles.js";
import { MEMBER_PALETTE, initials } from "../lib/constants.js";
import { useEscape } from "../lib/useEscape.js";

const uid = () => "m_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

// Manage project members: add, rename, recolor, remove.
// `taskCounts` maps member name -> number of tasks assigned (for safety on delete).
export default function MembersModal({ members, taskCounts, onChange, onClose }) {
  const [newName, setNewName] = useState("");
  const renameFrom = useRef(null);
  useEscape(onClose);

  function add() {
    const name = newName.trim();
    if (!name) return;
    if (members.some((m) => m.name === name)) { alert("חבר צוות בשם הזה כבר קיים."); return; }
    const color = MEMBER_PALETTE[members.length % MEMBER_PALETTE.length];
    onChange([...members, { id: uid(), name, color }], { type: "add", name });
    setNewName("");
  }

  // Update the name as the user types (no task re-tag); commit the rename on
  // blur so tasks are re-tagged once with the correct from→to.
  function rename(id, name) {
    onChange(members.map((m) => (m.id === id ? { ...m, name } : m)));
  }
  function commitRename(id, to) {
    const from = renameFrom.current;
    renameFrom.current = null;
    const t = to.trim();
    if (from == null || !t || t === from) return;
    onChange(members.map((m) => (m.id === id ? { ...m, name: t } : m)), { type: "rename", from, to: t });
  }

  function toggleController(id) {
    onChange(members.map((m) => (m.id === id ? { ...m, isController: !m.isController } : m)));
  }

  function recolor(id) {
    onChange(members.map((m) => {
      if (m.id !== id) return m;
      const i = (MEMBER_PALETTE.indexOf(m.color) + 1) % MEMBER_PALETTE.length;
      return { ...m, color: MEMBER_PALETTE[i] };
    }));
  }

  function remove(m) {
    const count = taskCounts[m.name] || 0;
    if (count > 0 && !confirm(`ל-${m.name} משויכות ${count} משימות. להסיר בכל זאת? המשימות יישארו אך ללא משויך.`)) return;
    onChange(members.filter((x) => x.id !== m.id), { type: "remove", name: m.name });
  }

  return (
    <div style={S.scrim} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...S.modal, maxWidth: 460 }}>
        <button style={S.close} onClick={onClose} aria-label="סגור">×</button>
        <h2 style={S.modalTitle}>חברי הצוות</h2>

        {members.map((m) => (
          <div key={m.id} style={S.memberRow}>
            <span style={{ ...S.swatch, background: m.color }} onClick={() => recolor(m.id)} title="שנה צבע" />
            <span style={{ ...S.ava, background: m.color, color: "#0D1117" }}>{initials(m.name)}</span>
            <input style={S.memberName} value={m.name}
              onFocus={() => { renameFrom.current = m.name; }}
              onChange={(e) => rename(m.id, e.target.value)}
              onBlur={(e) => commitRename(m.id, e.target.value)} />
            <button
              style={{ ...S.ctrlToggle, ...(m.isController ? S.ctrlToggleOn : {}) }}
              onClick={() => toggleController(m.id)}
              title={m.isController ? "מסומן כבקר — לחץ להסרה" : "סמן כבקר"}>בקר</button>
            <span style={S.memberCount}>{(taskCounts[m.name] || 0)}</span>
            <button style={S.fileX} onClick={() => remove(m)} aria-label="הסר" title="הסר">×</button>
          </div>
        ))}

        {!members.length && <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 8 }}>אין חברי צוות. הוסף את הראשון למטה.</div>}

        <div style={S.addMemberRow}>
          <input style={{ ...S.titleInput, margin: 0, fontSize: 14 }} value={newName}
            placeholder="שם חבר צוות חדש…" onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()} />
          <button style={{ ...S.primaryBtn, flex: "0 0 auto", padding: "11px 18px" }} onClick={add}>הוסף</button>
        </div>
      </div>
    </div>
  );
}
