import React, { useEffect, useRef, useState } from "react";
import { S, MUTED } from "../lib/styles.js";
import { putBlob, getBlob, deleteBlob } from "../lib/storage.js";

const MAX_BYTES = 25 * 1024 * 1024; // 25MB per file guard

function fmtSize(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function fileGlyph(type = "") {
  if (type.includes("pdf")) return "📕";
  if (type.includes("zip") || type.includes("compressed")) return "🗜️";
  if (type.includes("sheet") || type.includes("excel") || type.includes("csv")) return "📊";
  if (type.includes("word") || type.includes("document")) return "📄";
  if (type.startsWith("video/")) return "🎬";
  if (type.startsWith("audio/")) return "🎵";
  if (type.includes("step") || type.includes("stl") || type.includes("model")) return "🧩";
  return "📎";
}

const uid = () => "att_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Attachments for a single task. `value` is the metadata array; binary data
// is stored in IndexedDB keyed by attachment id (see lib/storage.js).
export default function Attachments({ value = [], onChange }) {
  const [urls, setUrls] = useState({}); // id -> object URL (images only)
  const [lightbox, setLightbox] = useState(null);
  const fileRef = useRef(null);
  const photoRef = useRef(null);

  const images = value.filter((a) => a.kind === "image");
  const docs = value.filter((a) => a.kind !== "image");

  // Resolve object URLs for image previews from IndexedDB.
  useEffect(() => {
    let revoked = [];
    (async () => {
      const next = {};
      for (const a of images) {
        if (urls[a.id]) { next[a.id] = urls[a.id]; continue; }
        const blob = await getBlob(a.id);
        if (blob) {
          const url = URL.createObjectURL(blob);
          next[a.id] = url;
          revoked.push(url);
        }
      }
      setUrls(next);
    })();
    return () => { revoked.forEach((u) => URL.revokeObjectURL(u)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.map((a) => a.id).join(",")]);

  async function addFiles(fileList) {
    const files = Array.from(fileList || []);
    const added = [];
    for (const file of files) {
      if (file.size > MAX_BYTES) {
        alert(`הקובץ "${file.name}" גדול מדי (מעל 25MB) ולא צורף.`);
        continue;
      }
      const id = uid();
      await putBlob(id, file);
      added.push({
        id,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        kind: file.type.startsWith("image/") ? "image" : "file",
        addedAt: new Date().toISOString(),
      });
    }
    if (added.length) onChange([...value, ...added]);
  }

  async function remove(id) {
    await deleteBlob(id);
    onChange(value.filter((a) => a.id !== id));
  }

  function openFull(id) {
    if (urls[id]) setLightbox(urls[id]);
  }

  return (
    <div style={S.attachWrap}>
      <div style={S.attachHeadRow}>
        <label style={{ ...S.fieldLabel, margin: 0 }}>קבצים ותמונות</label>
        <span style={{ fontSize: 11, color: MUTED }}>{value.length || ""}</span>
        <div style={S.attachBtns}>
          <button type="button" style={S.attachBtn} onClick={() => photoRef.current?.click()}>🖼️ תמונה</button>
          <button type="button" style={S.attachBtn} onClick={() => fileRef.current?.click()}>📎 קובץ</button>
        </div>
        <input ref={photoRef} type="file" accept="image/*" multiple hidden
          onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <input ref={fileRef} type="file" multiple hidden
          onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {!!images.length && (
        <div style={S.thumbGrid}>
          {images.map((a) => (
            <div key={a.id} style={S.thumb} onClick={() => openFull(a.id)} title={a.name}>
              {urls[a.id]
                ? <img src={urls[a.id]} alt={a.name} style={S.thumbImg} />
                : <div style={{ ...S.empty, padding: 0, marginTop: 28 }}>…</div>}
              <button type="button" style={S.thumbX}
                onClick={(e) => { e.stopPropagation(); remove(a.id); }} aria-label="הסר">×</button>
            </div>
          ))}
        </div>
      )}

      {docs.map((a) => (
        <div key={a.id} style={S.fileRow}>
          <span style={S.fileIcon}>{fileGlyph(a.type)}</span>
          <span style={S.fileName} title={a.name}>{a.name}</span>
          <span style={S.fileSize}>{fmtSize(a.size)}</span>
          <button type="button" style={S.fileX} onClick={() => remove(a.id)} aria-label="הסר">×</button>
        </div>
      ))}

      {!value.length && (
        <div style={{ fontSize: 12, color: MUTED }}>אין קבצים מצורפים. הוסף תמונות (סקיצות, צילומי מסך) או מסמכים (PDF, BOM, מודלים).</div>
      )}

      {lightbox && (
        <div style={S.lightbox} onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="תצוגה מלאה" style={S.lightboxImg} />
        </div>
      )}
    </div>
  );
}
