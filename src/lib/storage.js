// ============================== persistence ==============================
// Web build: structured data in localStorage, attachment blobs in IndexedDB.
// Desktop build (Electron): the same calls are transparently routed to a local
// SQLite database file via `window.mcStore` (exposed by the Electron preload).
// The web app code is unchanged — it just calls loadJSON/saveJSON/putBlob/etc.

const desktop = typeof window !== "undefined" && window.mcStore;

export function loadJSON(key, fallback) {
  try {
    const raw = desktop ? window.mcStore.getItemSync(key) : localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  try {
    const json = JSON.stringify(value);
    if (desktop) window.mcStore.setItemSync(key, json);
    else localStorage.setItem(key, json);
  } catch (e) {
    console.warn("saveJSON failed", e);
  }
}

// ----- IndexedDB attachment blob store -----
const DB_NAME = "mc-attachments";
const STORE_NAME = "blobs";
let dbPromise = null;

function getDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(mode, fn) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_NAME, mode);
    const store = t.objectStore(STORE_NAME);
    const out = fn(store);
    t.oncomplete = () => resolve(out?.result ?? out);
    t.onerror = () => reject(t.error);
  });
}

export const isDesktop = !!desktop;

export async function putBlob(id, blob) {
  if (desktop) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    return window.mcStore.putBlob(id, buf, blob.type || "application/octet-stream", blob.name || id);
  }
  return tx("readwrite", (s) => s.put(blob, id));
}

// Desktop only: open the attachment in the OS default app / reveal it in the
// file manager. No-ops on web (the UI shows a download button there instead).
export function openAttachment(id) { if (desktop) return window.mcStore.openBlob(id); }
export function revealAttachment(id) { if (desktop) return window.mcStore.revealBlob(id); }

export async function getBlob(id) {
  if (desktop) {
    const rec = await window.mcStore.getBlob(id);
    if (!rec) return undefined;
    return new Blob([rec.bytes], { type: rec.type || "application/octet-stream" });
  }
  return tx("readonly", (s) => s.get(id));
}

export async function deleteBlob(id) {
  if (desktop) return window.mcStore.deleteBlob(id);
  return tx("readwrite", (s) => s.delete(id));
}

// Read a File into a data URL (used to render image previews).
export function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
