# Mission Control — Project Changelog

A running log of changes, decisions, and actions taken during development.
Newest entries at top. Dates are when the work happened in our sessions.

---

## 2026-06-16 — Runnable MVP + members, attachments & photos

**Added:** A real, runnable Vite + React project (was a single `.jsx` before).
Structure: `src/lib/{constants,storage,styles}.js` and
`src/components/{TaskModal,MembersModal,Attachments}.jsx` driven by `src/App.jsx`.

New features on top of the solidified MVP:
- **Project members** — add/rename/recolor/remove team members (`MembersModal`).
  `PEOPLE` is no longer a hard-coded constant; members are state persisted under
  `mc:members:v2` and drive the assignee/controller pickers. Each member has a color
  + avatar. Removing a member with assigned tasks asks for confirmation.
- **File attachments & photos** on tasks (`Attachments`). Images show as thumbnails
  with a lightbox; other files (PDF/BOM/CAD…) show as rows. Binaries live in
  **IndexedDB** (store `mc-attachments`) so they don't hit the localStorage quota —
  the task only stores attachment metadata.
- **Search** (title/notes/people/assembly), **overdue** date highlighting, and
  **JSON backup** export/import.

**Decision:** Kept Phase-1 browser persistence (no backend, no AI) per SPEC. Backend +
multi-project (Phase 2) and the AI agent (Phase 3) remain the next steps. Attachment
binaries are device-local for now and are intentionally excluded from the JSON backup.

---

## 2026-06-16 — MVP solidified, AI deferred to Phase 2

**Decision:** Build the MVP as a **single-project task manager with no AI**. AI agent and multi-project support move to later phases.
- Rationale: the task tracker is commoditized; the real value is the AI agent. But the agent needs a solid data model + backend underneath it first. Single-project ships faster and validates the core. Multi-project is an easy wrap later.

**Decision:** AI cannot run from the browser (API key can't be exposed). The agent will live server-side in Phase 3 via a `/api/agent` endpoint. Removed the direct browser→AI call from the app.

**Added:**
- `mission-control-mvp.jsx` — solidified app, no AI:
  - **Add task** flow (the FAB now opens a full add-task modal — previously missing).
  - Edit modal reworked to share one component with add mode.
  - **Delete task** with inline confirm.
  - **Built-in audit log** — every add/edit/delete recorded with timestamp, viewable in a drawer ("יומן" button).
  - Field-level change tracking (logs old → new value).
- `SPEC.md` — technical backbone document for the coded version (data model, architecture, API surface, agent contract, phased build checklist).
- `CHANGELOG.md` — this file.

**Changed:**
- Replaced the always-on AI assistant rail with the add-task FAB.
- Storage keys bumped to `mc:tasks:v2` / `mc:auditlog:v2`.

---

## 2026-06-16 — Mobile + assistant-as-button (previous app iteration)

**Changed:** Assistant panel converted from an always-open side rail to a floating button that opens a full-screen drawer. Made the whole app mobile-responsive (board collapses to one column on phones, KPIs to 3-up, tabs scroll, modal fields stack).

*Note: this iteration still had the browser-side AI call, which we removed in the MVP above.*

---

## 2026-06-16 — First interactive app prototype

**Added:** React `mission-control-app.jsx` — interactive dashboard with persistent storage, three views (board / by-person / by-assembly), task detail modal, and an experimental AI command bar (later removed for the MVP).

**Decision:** App is for a single user (personal project assistant), not a multi-user team tool — informed the storage and scope choices.

---

## 2026-06-16 — Excel "mission control" workbook (origin)

The project started as an upgrade to an Excel tracking sheet. Delivered an `.xlsx` workbook with:
- Dark "HUD" dashboard theme; later switched to **white background** with a dark frozen header zone (title + KPI tiles + column headers stay fixed while scrolling).
- Live KPI tiles (COUNTIF) per status; removed the completion-percentage readout (always more tasks coming).
- Auto-coloring statuses via conditional formatting: בוצע green, בעבודה yellow, תקוע red, לבדיקה pink.
- **מכלול** column with one distinct color per assembly.
- Dropdown validation for status / priority / assembly / assignee.
- "By person" and "by assembly" filtered sheets driven by a selector cell.
- Separate **procurement (בקרת רכש)** sheet: item, supplier, status, order date, expected arrival, cost.
- Real Excel AutoFilter for sort/filter; row/column headers kept visible for inserting rows.
- Fixed a "not updating live" issue by forcing automatic calculation mode in the file.

**Key takeaways carried into the app:**
- Status palette: בוצע green / בעבודה yellow / תקוע red / לבדיקה pink.
- Assemblies each get a unique color.
- No completion percentage.
- Keep it usable on mobile.

---

## How to use this file
Add a dated entry whenever you make a meaningful change or decision. Keep entries short: what changed, and why. This is the project's memory — especially useful when handing off to a developer or returning after a break.
