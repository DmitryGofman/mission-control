# מרכז בקרת משימות (Mission Control) — Definitive Review

A Hebrew (RTL) task manager for hardware-engineering projects, shipped as a web PWA
and a Windows desktop app (Electron + local SQLite) from one React codebase. Data is
local-only — **no server, no accounts, no sync** — and the architecture is
**single-project-per-file**: each project lives in its own `mission-control.db` / app copy.

This review consolidates verified findings from four personas (CTO, team manager, lead
engineer, junior). Every item below was re-checked against the source. Duplicate
findings across personas are merged into themes; only confirmed/partial items are kept.

---

## 1. Critical bugs / data-loss risks (P0 / P1)

These are real defects that lose or corrupt user data, or silently mis-attribute it. For
a single-file, no-server tool, the backup path **is** the disaster-recovery path, so
gaps there are effectively data loss.

### 1.1 JSON backup silently drops the assemblies list and project name — broken DR (P1)
The most-reported, highest-consensus bug (CTO, manager, junior all hit it).

- `exportBackup()` serializes only `{ tasks, members, proc, log, exportedAt }`
  (`src/App.jsx:236`). The assemblies map (`STORE.assemblies`, persisted at
  `App.jsx:98`) and `projectName` (`STORE.project`, persisted at `App.jsx:99`) are never
  written.
- `importBackup()` restores only tasks/members/proc/log (`App.jsx:249-252`); it never
  calls `setAssemblies` / `setProjectName`.
- On restore to a clean machine, every task's מכלול color falls back to neutral gray via
  `asmColor()` (`constants.js:22-24` returns `#5A6573` for unknown names), the managed
  assembly list is empty, and the project name is blank.
- The **desktop** backup has the identical omission (`desktop/main.js:60`), so this is
  not web-only.
- Notably the Excel import path **does** merge new assemblies (`main.js:91-97`), which
  makes the JSON omission an isolated, fixable gap rather than a design stance.
- The alert at `App.jsx:254` discloses attachment loss but says nothing about
  assemblies/project loss — so it is **silent**.

**Fix (small):** add `assemblies` and `projectName` to the `exportBackup()` payload (web
and desktop) and restore them in `importBackup()` with `typeof` guards for older files.
Bump the backup format version.

### 1.2 Importing a JSON backup overwrites everything with no confirmation (P1)
- `importBackup()` (`App.jsx:244-258`) unconditionally calls
  `setTasks/setMembers/setProc/setLog` the moment the file parses — no `confirm()`, no
  replace-vs-merge prompt.
- This is an internal inconsistency: the Excel import path **does** ask, branching on a
  three-button dialog (`main.js:119-125`, replace vs. add vs. cancel).
- Picking the wrong file instantly and irreversibly destroys the current project's
  tasks/members/proc — there is no server copy to fall back to.

**Fix (small):** add a `confirm()` (or mirror the Excel replace/merge dialog) before
applying an imported backup.

### 1.3 Renaming a team member orphans all their tasks (P1)
Confirmed; inconsistent with the assembly-rename path that does it correctly.

- `changeMembers()` (`App.jsx:206-210`) handles only `add` / `remove` — there is **no
  rename branch**.
- `MembersModal.rename()` (`MembersModal.jsx:23-25`) calls `onChange(members.map(...))`
  with **no event argument at all**, so `changeMembers` couldn't detect a rename even if
  it wanted to.
- Tasks store assignee/controller as plain name strings (`who: "ליאב"`, `ctrl: "דימה"`
  in SEED, `constants.js:57-66`). After renaming `אמיתי → נדב`, every task keeps
  `who: "אמיתי"`.
- Downstream breakage: the by-person `FilterView` filters `t.who === filterPerson` where
  options are the new `memberNames` (`App.jsx:412-413`), so the old name's tasks become
  unreachable; the בקר select breaks the same way (`TaskModal.jsx:191`).
- Contrast `changeAssemblies()` which **does** re-tag tasks on rename
  (`App.jsx:122-125`: maps `t.asm === evt.from → evt.to`).

**Fix (small):** fire `onChange(next, { type: "rename", from, to })` from
`MembersModal.rename`, and in `changeMembers` remap `t.who === from → to` and
`t.ctrl === from → to`, plus `record()` the rename — mirroring the existing assembly
pattern.

### 1.4 Blank assignee is silently force-assigned to the first member (P1)
Confirmed (lead engineer + junior).

- `TaskModal.save()` emits `who: draft.who || memberNames[0] || ""`
  (`TaskModal.jsx:161`). Leaving "מי מבצע" untouched silently assigns the task to
  members[0].
- The picker offers no "ללא משויך" option (`whoOptions`, `TaskModal.jsx:150-151`).
- The rest of the code already tolerates an empty assignee: `saveTask` logs
  `who || "ללא משויך"` (`App.jsx:135`) and the report uses `t.who || "—"`
  (`App.jsx:279`). The force-assign is the only thing preventing the empty case from
  ever occurring on new tasks.
- Result: tasks attributed to someone not doing them, skewing the לפי איש צוות view and
  workload counts.

**Fix (small):** save `who` as-is (allow empty) and add an explicit "ללא משויך" option to
the picker and the by-person filter.

> Severity note: items 1.1 and 1.4 were flagged P0 by the junior persona. I keep them at
> P1 — both are genuine data integrity bugs but neither bricks the app or corrupts the
> DB silently on normal use; they degrade restores and attribution. Still, fix all four
> in the first pass: each is a small, self-contained change.

---

## 2. High-value improvements, grouped by theme

Each notes which personas asked and a rough effort. These are enhancements, not defects.

### Theme A — Multi-project & portfolio rollup *(CTO, manager; large)*
The single biggest structural limitation, and an explicit recurring ask.

- All state loads from fixed single-project keys (`STORE`, `constants.js:70-77`) into one
  App instance (`App.jsx:79-92`). The header "+ שם פרויקט" input is just a label on one
  file (`App.jsx:377`); there is no project selector, aggregate board, or cross-team
  resource view.
- `SPEC.md` explicitly defers this to Phase 2 (multi-project, `projectId`), so it is
  **scoped-out, not a regression** — do not treat it as a defect.
- The CTO can't see blockers/overdue across 4-6 programs; the manager can't get a
  person's combined load across their ~2 files.

**Interim option (medium, high leverage):** a read-only folder-scan rollup that ingests
several `mission-control.db` files (or several exported JSON backups) for a combined
blocker/overdue/workload view only — no write path, no schema change to the per-file app.
This delivers ~80% of the CTO value without the Phase-2 architecture.

### Theme B — Scheduling, deadlines & dependencies *(CTO, manager; medium-large)*
- **No dependencies / "blocked by".** The task schema (`store.js:19-23`, SEED) has no
  dependency field; "תקוע" is only a status string (`constants.js:7`). Procurement is a
  fully disjoint table (`store.js:25-28`) with no task cross-reference, so a
  procurement-delay-as-blocker — the persona's #1 board question — can't be expressed.
  The report can list blockers (תקוע first, `App.jsx:269`) but not the causal chain.
  *Fix (medium):* optional "blocked by" link on a task to another task and/or a
  procurement id, surfaced in the report's blockers section.
- **No milestones / customer-deadline marker.** Every date is a per-task due (תג״ב,
  `DD.M.YY`); no milestone concept exists in schema or SPEC Phase 1. *Fix (medium):* a
  separate deadline/milestone anchor.
- **No reminders / notifications.** A search for
  `setInterval/setTimeout/Notification/reminder/cron` finds only the agenda popover, undo
  timers, and the bundled React scheduler — nothing schedules or fires anything. Overdue
  surfaces only via passive red highlighting when a human opens a view. *Fix
  (medium, desktop-only):* Electron native notifications on app open / on a timer for
  overdue/critical tasks — a contained enhancement.

### Theme C — Collaboration & the controller/review flow *(manager; medium)*
- **Controller flow captured but not actionable.** Tasks carry `ctrl`
  (`TaskModal.jsx:191`) and members carry `isController` (`MembersModal.jsx:27`), but no
  view filters by `ctrl`. The לבדיקה status and the report's "ממתינות לבדיקה" section
  (`App.jsx:270`) are global, not scoped to a reviewer; there is no "לבדיקה שלי"
  shortcut. *Fix (medium):* a by-controller filter (reuse `FilterView` with
  `options = controllers`, items filtered by `t.ctrl`) plus an optional "my reviews"
  shortcut. This makes the review gate — the manager's main lever — usable.

### Theme D — Reporting *(CTO, manager; small-medium)*
- **Every export is anonymous.** `projectName` exists and is bound to the header
  (`App.jsx:43,377`) but is referenced nowhere in output. `exportDevSummary()` hardcodes
  `<h1>דוח סטטוס פרויקט</h1>` (`App.jsx:322`) and the subline "מרכז בקרת משימות"
  (`App.jsx:323`); `exportXlsx` never receives a project identifier (`excel.js`). With N
  files, every PDF/Excel is titled identically — a real board-reporting hazard. *Fix
  (small):* thread `projectName` into the report H1/subline and into an Excel header
  cell / filename.
- **Cross-team workload view missing; counts mix done with active.** by-person is a
  single-select `FilterView` (`App.jsx:412`) — one person at a time, no team grid.
  `taskCounts` (`App.jsx:343-347`) counts every task per assignee with **no status
  filter**, so completed (בוצע) tasks inflate the number shown in MembersModal
  (`MembersModal.jsx:61`). *Fix (medium):* a team-overview panel (or extend
  MembersModal) showing each member's active counts split by status; cheapest version is
  to make the MembersModal count active-only.
- **No "unassigned" bucket/filter.** Combined with 1.4: even after a member is removed
  (which leaves `who` intact, `MembersModal.jsx:39-43`), genuinely unassigned work is
  invisible because the by-person options are exactly `memberNames` (`App.jsx:412`). *Fix
  (small):* add a "ללא משויך" filter option.

### Theme E — Mobile / RTL polish *(junior; medium)*
- **Swipe directions feel inverted in RTL.** `SwipeRow` maps `d >= THRESH` (rightward) →
  `onComplete` and `d <= -THRESH` (leftward) → `onPostpone`
  (`SwipeRow.jsx:36-37`), with labels "✓ בוצע" on `dx>0` and "דחה למחר 📅" on `dx<0`
  (lines 47-51). The styles back this (`swipeActionL` green/complete, `swipeActionR`
  blue/postpone, `styles.js:65-66`). The mapping is **not** mirrored for `dir="rtl"`,
  even though the whole UI is RTL, so the more consequential action (mark בוצע) sits on
  the less-intuitive side for a Hebrew reader. Used by both the agenda and the filter
  lists. Mitigated by undo (toast + Ctrl+Z), so this is friction, not data loss. *Fix
  (medium):* mirror the gesture for RTL (or make it configurable) and keep labels
  consistent with the chosen mapping.
- **Onboarding for newcomers.** The due field is labeled only "תג״ב" — an abbreviation a
  newcomer won't recognize (`FIELD_LABELS`, `App.jsx:20`; `TaskModal.jsx:197`). The app
  opens directly on SEED demo data (`App.jsx:80`) with no first-run hint or "clear demo
  data" affordance. *Fix (small):* add a "תאריך יעד" tooltip/secondary label and a
  lightweight first-run hint or clear-demo button.

### Theme F — Desktop / Excel *(manager; small)*
- **"Linked Excel auto-sync" is write-only but labeled as if bidirectional.**
  `syncLinkedExcel()` only **writes** the file (`main.js:32-36`); it never reads it back.
  It is triggered on every tasks/proc `setItem` (`main.js:233`). The menu label "קשר
  Excel לעדכון אוטומטי…" (`main.js:164`) and the confirmation "הקובץ יתעדכן אוטומטית אחרי
  כל שינוי" (`main.js:141`) read as two-way; a user who edits the linked file will have
  their edits silently overwritten on the next in-app change. *Fix (small, pure copy):*
  relabel as a one-way live export (e.g. "ייצוא חי לאקסל (קריאה בלבד)") and state in the
  dialog that edits to the file are not read back.
- **Audit log capped at 500, truncates silently.** `record()` does `[...].slice(0, 500)`
  on every write (`App.jsx:103`); `store.setItem` for `audit_log` rewrites the whole
  table from that array (`store.js:122-125`), so the SQLite DB faithfully mirrors the
  cap — it is enforced in React, not the DB, which has no practical limit. On an active
  program, 500 entries is reached in weeks and oldest history drops with no warning,
  undermining the "defensible change history" claim. *Fix (small):* raise the cap (e.g.
  5000), or on desktop stop slicing and paginate the viewer.
- **By-person view can open empty.** `setFilterPerson(m[0]?.name || "")` (`App.jsx:89`)
  defaults to the first member regardless of task ownership, and there is no "all" option
  (`App.jsx:412`). If member #1 owns no tasks, "לפי איש צוות" opens empty — reading as "no
  work" rather than "wrong person." The needed data (`taskCounts`) already exists
  (`App.jsx:343-347`). *Fix (small):* default to the highest-load member, or add an
  "all people" option.
- **Clearing the audit log is irreversible with only a basic confirm.** The "נקה" button
  calls `onClear()` after a single `confirm("לנקות את היומן?")` (`App.jsx:687`), wired to
  `setLog([])` (`App.jsx:463`). Unlike delete/complete/reschedule, which route through
  `showUndo()`, clearing the log has no undo and no export-first step. *Fix (small):*
  offer to export the log before clearing, or wire it into the existing undo toast.

---

## 3. Simplify / remove — complexity not worth its value

Each candidate was checked; **none warrant removal.** The honest read is that the modal
is heavy for solo/oversight use, but the features are legitimate and used by other
personas. The right framing is opt-in simplification, not deletion.

- **Per-task comment threads** (`TaskModal.jsx:97-137`). The "don't survive backup" claim
  is **partly wrong**: comments are a nested array on the task object, so they **do** ride
  along in the JSON backup (the whole task is serialized, `App.jsx:236`). The only real
  cost is modal length, a subjective/altitude preference. *Keep.*
- **Attachments (files/photos + lightbox).** Binaries are stored via `putBlob` in the
  SQLite `attachments` table (`store.js:30,132-134`) / IndexedDB on web; only metadata
  rides in `task.attachments`. The backup **does** exclude binaries (confirmed by the
  alert at `App.jsx:254` and by `exportBackup` writing no blobs) — so the
  backup-incompleteness point is correct, but "remove the feature" is a preference, not a
  defect. *Keep; the actionable issue is the backup gap (pair with 1.1):* either include
  blobs in a richer ZIP backup or make the "incomplete backup" warning more prominent.
- **בקר (controller), comments, and the רכש tab for solo use** (`TaskModal.jsx:190-196`,
  `97-137`; `App.jsx:425`). These add modal length and a top-level tab a solo junior
  rarely needs, but removing them breaks the structured-team use case the app is built
  for. *Keep.*
- **Tags** (`TaskModal.jsx:62-95`). Legitimate; low cost. *Keep.*

**Recommended (optional, low priority):** a single "מצב פשוט / simple mode" settings
toggle that collapses tags + comments + attachments behind a "more" disclosure and hides
בקר and the רכש tab by default — leaving title/assembly/status/assignee/due/notes/
checklist. This shortens the common edit for the junior without taking power features
away from the team. Cosmetic polish, not a fix.

---

## 4. Prioritized roadmap

### Now (data-integrity first pass — all small, ship together)
1. Add `assemblies` + `projectName` to JSON backup export **and** import (web + desktop). *(1.1)*
2. Add a confirm / replace-vs-merge prompt before applying a JSON import. *(1.2)*
3. Implement member rename: thread a `{type:"rename",from,to}` event and remap `who`/`ctrl`. *(1.3)*
4. Stop force-assigning a blank `who`; add "ללא משויך" to the picker and by-person filter. *(1.4)*
5. Relabel "linked Excel auto-sync" as a one-way live export (copy-only, prevents silent loss). *(F)*

### Next (high-value, low-medium effort)
6. Thread `projectName` into the status-report H1/subline and the Excel header/filename. *(D)*
7. Add a by-controller filter + "לבדיקה שלי" shortcut to make the review gate actionable. *(C)*
8. Make MembersModal/workload counts active-only and add a per-status team-overview panel. *(D)*
9. Mirror swipe gestures for RTL (left = complete) and add a "תאריך יעד" tooltip + first-run/clear-demo hint. *(E)*
10. Raise the audit-log cap (or stop slicing on desktop + paginate); export-before-clear on log wipe; default by-person to highest-load member. *(F)*

### Later (roadmap / architectural)
- Read-only multi-file portfolio rollup for combined blocker/overdue/workload (interim before Phase 2). *(A)*
- Optional task↔task / task↔procurement "blocked by" dependencies, surfaced in the report. *(B)*
- Milestones / customer-deadline anchors; desktop native reminders for overdue/critical. *(B)*
- Richer ZIP backup that includes attachment blobs (or a more prominent "incomplete backup" warning). *(§3)*
- Optional "simple mode" toggle for solo users. *(§3)*

---

## Rejected / non-findings

- **"Comments don't survive backup."** Incorrect — comments are nested on the task object
  and are serialized into the JSON backup (`App.jsx:236`). Only attachment **binaries** are
  excluded.
- **"Remove comments / attachments / controller."** Rejected as removals — these are
  legitimate, used features; the real issue is the attachment-blob backup gap and optional
  modal de-cluttering, not deletion.
- **Multi-project rollup as a "bug/regression."** Rejected — it is an explicitly
  SPEC-deferred Phase-2 scope item, not a defect. Tracked as a roadmap theme.
