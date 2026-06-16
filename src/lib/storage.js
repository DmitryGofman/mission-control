// ============================== persistence ==============================
// Structured data (tasks, members, audit log) lives in localStorage.
// Binary attachments (files + photos) live in IndexedDB so large images
// don't blow the ~5MB localStorage quota — the task only keeps metadata.

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
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

export async function putBlob(id, blob) {
  return tx("readwrite", (s) => s.put(blob, id));
}

export async function getBlob(id) {
  return tx("readonly", (s) => s.get(id));
}

export async function deleteBlob(id) {
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
