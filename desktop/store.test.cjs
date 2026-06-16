// Standalone test of the SQLite store logic (no Electron needed).
const fs = require("fs");
const os = require("os");
const path = require("path");
const store = require("./store");

const assert = (c, m) => { if (!c) { console.error("FAIL:", m); process.exit(1); } else console.log("ok:", m); };

(async () => {
  const dbFile = path.join(os.tmpdir(), `mc-test-${Date.now()}.db`);
  await store.init(dbFile);

  // 1) First run: getItem returns null so the app seeds defaults.
  assert(store.getItem("mc:tasks:v2") === null, "first run -> tasks null (seed)");

  // 2) Save tasks with nested fields + members + audit, read back identical.
  const tasks = [
    { id: 1, asm: "Sbru", task: "תכן", pri: "גבוה", status: "בעבודה", who: "אופק", ctrl: "דימה", due: "18.6.26",
      notes: "נדחה", tags: ["קריטי", "מחכה לספק"], checklist: [{ id: "c1", text: "א", done: true }],
      comments: [{ id: "k1", author: "דימה", text: "הערה", ts: "2026-06-16T10:00:00Z" }], attachments: [{ id: "att1", name: "x.pdf", type: "application/pdf", size: 10, kind: "file" }] },
    { id: 2, asm: "כללי", task: "BOM", pri: "בינוני", status: "בוצע", who: "ליאב", ctrl: "", due: "", notes: "", tags: [], checklist: [], comments: [], attachments: [] },
  ];
  store.setItem("mc:tasks:v2", JSON.stringify(tasks));
  const back = JSON.parse(store.getItem("mc:tasks:v2"));
  assert(JSON.stringify(back) === JSON.stringify(tasks), "tasks round-trip (nested) identical");

  const members = [
    { id: "m1", name: "דימה", color: "#E8B84B", isController: true },
    { id: "m2", name: "אלון", color: "#58A6FF", isController: false },
  ];
  store.setItem("mc:members:v2", JSON.stringify(members));
  assert(JSON.stringify(JSON.parse(store.getItem("mc:members:v2"))) === JSON.stringify(members), "members round-trip (isController bool)");

  const log = [
    { ts: "2026-06-16T12:00:00Z", action: "נוספה משימה", detail: "newest" },
    { ts: "2026-06-16T11:00:00Z", action: "עודכנה משימה", detail: "older" },
  ];
  store.setItem("mc:auditlog:v2", JSON.stringify(log));
  const logBack = JSON.parse(store.getItem("mc:auditlog:v2"));
  assert(logBack[0].detail === "newest" && logBack[1].detail === "older", "audit log order preserved (newest first)");

  // 3) Blobs round-trip.
  const bytes = new Uint8Array([1, 2, 3, 4, 250]);
  store.putBlob("att1", bytes, "application/pdf");
  const blob = store.getBlob("att1");
  assert(blob && blob.type === "application/pdf" && Buffer.compare(blob.bytes, Buffer.from(bytes)) === 0, "blob round-trip bytes+type");
  store.deleteBlob("att1");
  assert(store.getBlob("att1") === null, "blob delete");

  // 4) Persistence: re-open the file in a fresh module instance.
  delete require.cache[require.resolve("./store")];
  const store2 = require("./store");
  await store2.init(dbFile);
  const reloaded = JSON.parse(store2.getItem("mc:tasks:v2"));
  assert(reloaded.length === 2 && reloaded[0].tags.length === 2, "data persists across reopen");

  // 5) After clearing tasks, table is empty (no accidental re-seed).
  store2.setItem("mc:tasks:v2", JSON.stringify([]));
  assert(JSON.parse(store2.getItem("mc:tasks:v2")).length === 0, "cleared tasks stay empty (no re-seed)");

  fs.unlinkSync(dbFile);
  console.log("\nALL TESTS PASSED");
})();
