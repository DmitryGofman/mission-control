# Mission Control — v2 multi-user plan (shared network folder)

> Saved plan. Status as of v0.4.1: the app is **single-writer**. This document
> describes how to make ~5 people edit the same project concurrently from a
> shared network folder, **without a server**. Pick this up later.

## Goal
~5 people (room to grow) on machines connected to the LAN, each editing
**different** tasks at the same time, seeing each other's changes live, with no
data loss. No server / no admin — just a shared folder everyone can read+write.

## Deployment model (decided direction)
- Each user runs a **local copy** of the app (portable; no admin installer needed).
- A **shared project folder** on the server holds the data:
  ```
  <shared folder>/
    project.db          ← snapshot (base state)
    oplog/              ← append-only operations, one small file per edit
        2026-06-29T10-15-03_120Z__<client>__<seq>.json
    attachments/        ← shared real files (already file-based today)
  ```
- The app gets a **"Connect to project folder…"** setting pointing at that folder
  (instead of always using the folder next to the exe). Keeps the exe local
  (fast, avoids "run exe from network" policy/perf issues) while data is shared.

## Core idea: append-only op-log (avoids whole-file clobbering)
Today every change rewrites the **entire** DB → concurrent writers overwrite each
other. v2 replaces that with per-change **operations**:
- Each edit = a small op: `{ op:"upsert"|"delete", entity:"task"|"proc"|"member"|"assembly"|"project", id, fields:{...}, ts, client }`.
- Each client appends ops to **its own uniquely-named files** in `oplog/` →
  two clients never write the same file → **no write conflict on SMB** (the key
  trick that removes the need for a server/lock).
- Current state = `project.db` snapshot + all `oplog/` ops applied in `ts` order.

## Live refresh
- Each instance **watches** `oplog/` (fs.watchFile/poll, robust on SMB).
- New files from others → apply their ops to in-memory state → push the delta to
  the renderer (update only what changed; do **not** full-reload; don't clobber a
  modal the user has open).

## Merge / conflict rule (decided direction: per-field last-writer-wins)
- Ops applied in `ts` order → latest write to a field wins.
- Two people on **different** tasks → clean merge (the common case).
- Same field at once → newest `ts` wins (acceptable for ~5 users). Optionally
  surface a subtle "X also edited this" note later.

## Stable unique IDs
- New tasks/proc/members get a **globally-unique id** (e.g. `client-rand-counter`
  or a high-entropy value) so two people creating at once never collide.
- Keep existing numeric ids working (treat ids as opaque).

## Compaction
- Periodically fold `oplog/` into `project.db` and delete folded op files, behind
  a short **lock file** (only one client compacts at a time). Triggered by op
  count / size threshold; safe to skip if the lock is held.

## Renderer integration (least-invasive path)
- Main process becomes the canonical model: keeps state in memory, persists via
  oplog, watches for others' ops.
- Renderer keeps its array-based React state. The storage layer **diffs**
  old→new arrays on save to emit ops, and applies inbound ops by pushing updated
  slices to the renderer (merge into state, not a full reload).
- Nice-to-have: presence ("who's online / editing X"), via heartbeat files in a
  `presence/` folder.

## Phases
1. **Foundation:** oplog store (write/read/rebuild) + unique ids. Verify with a
   **2-client Node simulation** on one shared folder (create/edit/delete in
   parallel → correct merge, zero clobber).
2. **Live refresh:** watch oplog, push deltas to the renderer mid-session.
3. **Polish:** compaction + lock, presence/"who's editing", crash resilience,
   atomic writes (temp file + rename), backup.

## Risks
- Can't fully test 5 real machines here → rely on simulated multi-client tests.
- SMB quirks (latency, locking) → use polling watch + atomic temp-rename writes.
- Data migration from the current single-file DB → import once into the snapshot.

---

## Interim option (v1.5): "Excel-as-shared-DB with write serialization"
A lighter stop-gap proposed for the prototype phase — share the **flat task table**
via one Excel file on the network, serialize writes:
- Each user runs locally, linked to one shared `.xlsx`.
- Every update = **lock → read the file fresh → apply this one row change →
  write → unlock** (re-reading fresh each time avoids clobbering).
- If the lock is held (someone mid-write), warn "busy, try again in a moment".
- Lock = an atomic lock file with a timeout (auto-release if a writer crashed).
- Live view = watch the file and reload (already built in v0.4.x two-way sync).

**Limits to accept for a prototype:**
- Excel carries only the flat columns → **checklists / comments / attachments are
  NOT shared** (stay local). Fine for a demo of the task table.
- If a user opens the file in the **actual Excel app**, it locks the file and app
  writes fail → must warn / ask them to close it.
- Coarse concurrency (one writer at a time); whole-file rewrite per change.

**Verdict:** Genuinely easier than full v2 and workable for a ~5-person prototype.
Good bridge until v2 (the oplog model) is built.

---

## ⚠️ Known build pitfalls (must-fix when resuming this work)

The v0.5.0 shared-sync build crashed on launch with:
```
Uncaught Exception: Error: Cannot find module './syncmerge'
Require stack: …\resources\app.asar\main.js
```
**Root cause:** a new main-process file (`desktop/syncmerge.js`) was `require()`d
by `main.js` but **NOT added to the electron-builder `files` whitelist** in
`desktop/package.json`, so it was excluded from `app.asar`. The merge *logic* was
correct and unit-tested — it just wasn't packaged.

**THE FIX (do this whenever adding ANY new main-process file):** add the new
file to `build.files` in `desktop/package.json`. That list is a strict
whitelist — only what's listed is bundled. (Same class of bug that once omitted
`store.js`/`excel.js`.) After adding, the v0.5.0 multi-user code should run.

**Checklist when resuming multi-user:**
1. Re-apply the v0.5.0 changes (syncmerge.js, main.js sync engine, preload
   onDataChanged/onSyncBusy, storage.js, App.jsx live-update + busy toast).
2. **Add `syncmerge.js` (and any other new files) to `build.files`.**
3. Verify the CI build, then actually launch the packaged exe (or test under
   Electron) — a successful electron-builder run does NOT prove all required
   files were whitelisted; only launching does.
