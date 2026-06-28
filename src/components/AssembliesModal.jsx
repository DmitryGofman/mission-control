import React, { useState } from "react";
import { S, MUTED } from "../lib/styles.js";
import { MEMBER_PALETTE, readable } from "../lib/constants.js";
import { useEscape } from "../lib/useEscape.js";

// Manage the מכלול list: add, rename, recolor, remove. `assemblies` is a
// { name: color } object; `onChange(next, evt)` persists it (and the App also
// re-tags tasks on rename).
export default function AssembliesModal({ assemblies, tasks, onChange, onClose }) {
  const [newName, setNewName] = useState("");
  const [draft, setDraft] = useState(null); // { key, value } while a name is being edited
  useEscape(onClose);

  const names = Object.keys(assemblies);
  const countOf = (name) => tasks.filter((t) => t.asm === name).length;

  function add() {
    const name = newName.trim();
    if (!name) return;
    if (assemblies[name]) { alert("מכלול בשם הזה כבר קיים."); return; }
    const color = MEMBER_PALETTE[names.length % MEMBER_PALETTE.length];
    onChange({ ...assemblies, [name]: color }, { type: "add", name });
    setNewName("");
  }

  // Edit the name locally as the user types (no task re-tag / audit spam, and the
  // object key stays stable so the input keeps focus). Commit once on blur.
  function commitRename(oldName, value) {
    setDraft(null);
    const to = value.trim();
    if (!to || to === oldName) return;
    if (assemblies[to]) { alert("מכלול בשם הזה כבר קיים."); return; }
    // Rebuild preserving order with the key renamed.
    const next = {};
    for (const [k, v] of Object.entries(assemblies)) next[k === oldName ? to : k] = v;
    onChange(next, { type: "rename", from: oldName, to });
  }

  function recolor(name) {
    const i = (MEMBER_PALETTE.indexOf(assemblies[name]) + 1) % MEMBER_PALETTE.length;
    onChange({ ...assemblies, [name]: MEMBER_PALETTE[i] });
  }

  function remove(name) {
    const c = countOf(name);
    if (c > 0 && !confirm(`למכלול "${name}" משויכות ${c} משימות. להסיר בכל זאת? המשימות יישארו עם השם.`)) return;
    const next = { ...assemblies };
    delete next[name];
    onChange(next, { type: "remove", name });
  }

  return (
    <div style={S.scrim} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...S.modal, maxWidth: 460 }}>
        <button style={S.close} onClick={onClose} aria-label="סגור">×</button>
        <h2 style={S.modalTitle}>מכלולים</h2>

        {names.map((name) => (
          <div key={name} style={S.memberRow}>
            <span style={{ ...S.swatch, background: assemblies[name] }} onClick={() => recolor(name)} title="שנה צבע" />
            <span style={{ ...S.qAsm, background: assemblies[name], color: readable(assemblies[name]), flexShrink: 0 }}>{name || "—"}</span>
            <input style={S.memberName}
              value={draft && draft.key === name ? draft.value : name}
              onFocus={() => setDraft({ key: name, value: name })}
              onChange={(e) => setDraft({ key: name, value: e.target.value })}
              onBlur={(e) => commitRename(name, e.target.value)} />
            <span style={S.memberCount}>{countOf(name)} משימות</span>
            <button style={S.fileX} onClick={() => remove(name)} aria-label="הסר" title="הסר">×</button>
          </div>
        ))}

        {!names.length && <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 8 }}>אין מכלולים. הוסף את הראשון למטה.</div>}

        <div style={S.addMemberRow}>
          <input style={{ ...S.titleInput, margin: 0, fontSize: 14 }} value={newName}
            placeholder="שם מכלול חדש…" onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()} />
          <button style={{ ...S.primaryBtn, flex: "0 0 auto", padding: "11px 18px" }} onClick={add}>הוסף</button>
        </div>
      </div>
    </div>
  );
}
