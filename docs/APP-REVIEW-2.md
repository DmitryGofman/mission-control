# מרכז בקרת משימות (Mission Control) — Second-Round Review

A first-week, second-pass review of the **current** code, after the fixes recorded in
`docs/APP-REVIEW.md`. Items already fixed there (JSON backup completeness, import confirm,
member rename re-tag, "ללא משויך" assignee, honest Excel/linked-Excel label, מכלול picker,
web Excel) are **excluded** — verified fixed in source and not re-reported. What follows is
only what is still broken or rough, with file refs. Findings drawn from four personas
(CTO, team manager, lead engineer, junior).

---

## 1. Bugs still present

### 1.1 מכלול rename fires on every keystroke — re-tags tasks + spams audit log; blanks orphan tasks (P1)
The member-rename fix (APP-REVIEW 1.3) landed, but **AssembliesModal was never given the
same blur-commit treatment** — the two managed-list screens now diverge.

- `AssembliesModal` binds `onChange={(e) => rename(name, e.target.value)}` directly on the
  input (`AssembliesModal.jsx:55`). `rename()` (`AssembliesModal.jsx:25-30`) rebuilds the
  assemblies object and calls `onChange(next, { type: "rename", from, to })` on **every
  keystroke** whenever `value && value !== oldName`.
- `changeAssemblies` (`App.jsx:122-130`) reacts to each rename event by re-mapping the full
  task array (`t.asm === from → to`) **and** `record("שונה מכלול")`. So renaming
  `"Sbru" → "RF Front-End"` produces ~10 cascading re-tag passes and ~10 audit lines, with
  intermediate `t.asm` set to fragments ("R", "RF", "RF "…). `record()` slices to 500
  (`App.jsx:107`), so a few multi-char renames silently evict real history.
- **Blank-field orphan (new, not in APP-REVIEW):** clearing the field runs `rename("Sbru", "")`.
  Line 28 still rebuilds the object with a `""` key; line 29 suppresses the rename event
  because `value` is falsy. Net: the `"Sbru"` key vanishes from the managed list while every
  task keeps `asm: "Sbru"`, orphaning them to the gray `asmColor()` fallback
  (`constants.js:22-24`), and the list renders a blank chip via `{name || "—"}`
  (`AssembliesModal.jsx:54`). The member path (APP-REVIEW 1.3) does not have this hole.

**Fix (small):** mirror `MembersModal` exactly — a `renameFrom` useRef set on `onFocus`
(`MembersModal.jsx:66`), `onChange` updating only the local key with **no event**, and a
single `{type:"rename",from,to}` emitted in an `onBlur` `commitRename` that trims and
guards empty/unchanged (`MembersModal.jsx:29-35`). Collapses the storm to one re-tag + one
audit line and closes the blank-key orphan.
*Personas: all four (CTO, manager, lead, junior).*

### 1.2 Excel-imported real DATE cells silently vanish from לו״ז / overdue (P1)
Both importers read תג״ב as plain text and never detect a real date value.

- `importXlsx` reads `due: g(row, ["תג"])` where `g → cellText → String(cell.text).trim()`
  (`excelWeb.js:108,115,95`; desktop `excel.js:90,102,76`). ExcelJS's `cell.text` on a real
  Date cell renders the cell's number-format/locale (e.g. `6/18/2026`), **not** the app's
  `D.M.YY`.
- Every downstream consumer is the strict regex `/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/`:
  `dueToISO` returns `""` on mismatch (`constants.js:96`); `isOverdue` / `dueToDate` →
  `bucketOf` return null/false. So an imported task carries an unusable due that never
  appears in the agenda, never flags overdue, never sorts — **silent fidelity loss, no
  warning**. A user who builds the workbook in Excel (where dates are real date cells, the
  natural thing to do) loses every deadline on import.

**Fix (small):** in both `importXlsx` paths, before falling back to `cell.text`, detect a
real date — `if (cell.value instanceof Date)` (or `cell.type === ExcelJS.ValueType.Date`) —
and convert via the existing `dateToDue(date)` helper (`constants.js:112`); optionally also
parse common locale strings (`M/D/YYYY`) to `D.M.YY`. Fall through to literal text only when
no date is recognized.
*Personas: lead engineer.*

### 1.3 SEED demo data references controller "איבצן" who is not a member (P2/P3)
Shipped demo data has an internal inconsistency aimed straight at the first-week user.

- `SEED` task #6 has `ctrl: "איבצן"` (`constants.js:62`); `DEFAULT_MEMBERS` is
  דימה/אלון/ליאב/אמיתי/אופק — no איבצן (`constants.js:48-54`).
- `TaskModal` builds `ctrlOptions` from `isController` members **plus any legacy `ctrl`
  value** (`TaskModal.jsx:160-162`), so opening task #6 surfaces an unexplained "איבצן" in
  the בקר dropdown.

**Fix (trivial):** change `constants.js:62` `ctrl: "איבצן"` to a real member (e.g. `"דימה"`).
*Personas: junior.*

### 1.4 Rename onto an existing name silently merges identities (P2)
The `add()` paths reject duplicates (`MembersModal.jsx:18`, `AssembliesModal.jsx:19`) but the
rename paths do not.

- `MembersModal.commitRename` guards only empty/unchanged (`MembersModal.jsx:33`) — no check
  that the target name already belongs to another member. Renaming `"אלון" → "דימה"` yields
  two members named "דימה"; name-keyed lookups collapse them (`memberColor` uses
  `members.find(m => m.name === name)`, `App.jsx:636`; `taskCounts` is keyed by `t.who`,
  `App.jsx:399`).
- `AssembliesModal.rename`'s rebuild loop assigns `next[value] = v` (`AssembliesModal.jsx:28`),
  so renaming onto an existing key overwrites that color and fuses two assemblies' tasks.

**Fix (small):** apply the same duplicate check `add()` uses, in `commitRename` and in the
AssembliesModal blur-commit (pairs naturally with 1.1). Refuse with the existing
"בשם הזה כבר קיים" alert and revert the input.
*Personas: lead engineer.*

> **Not re-reported (verified fixed in code, per APP-REVIEW):** JSON backup now writes & restores
> `assemblies` + `projectName` (`App.jsx:248,268-269`); JSON import now confirms
> (`App.jsx:263`); member rename re-tags `who`/`ctrl` (`App.jsx:214-221`); "— ללא משויך —"
> exists in the picker (`TaskModal.jsx:208`) and as a by-person option (`App.jsx:468`).

---

## 2. First-week UX friction & quick wins
Small/medium effort, high daily value.

### 2.1 No "clear demo data / new project" affordance (P1, small-medium) — *lead, junior*
The app boots straight onto `SEED` (10 tasks), `DEFAULT_MEMBERS`, `PROC_SEED` as the
empty-storage fallback (`App.jsx:84-92`). There is **no** clear-all / new-project action: a
grep across `src` for `clearAll`/`resetAll`/`פרויקט חדש`/`נקה הכל` finds nothing, and the
SidePanel exposes only export/import/Excel/log (`App.jsx:521-531`). The only bulk replace is
the Excel import's "החלף הכל". To start a real project a lead deletes 10 tasks one-by-one
through the two-step modal confirm, plus 3 procurement rows and 5 seed members — ~15+
destructive clicks before real work. This is the highest-frequency week-one friction.
**Win:** add a "פרויקט חדש / נקה נתוני דוגמה" action to the ⋮ panel — single confirm, gated
behind an export-first prompt, clearing tasks/proc/log (keep or optionally reset
members+assemblies). Optionally only offer it while the data still equals the seed, and wire
it through the existing `showUndo` toast.

### 2.2 Reports & Excel sheets are project-anonymous in the body (P1, small) — *CTO, manager, junior*
`projectName` reaches **filenames only** — JSON backup (`App.jsx:252-253`), web Excel
(`excelWeb.js:69`). It is absent from every output body:
- `exportDevSummary` hardcodes `<title>…מרכז בקרת משימות` (`App.jsx:355`),
  `<h1>דוח סטטוס פרויקט</h1>` (`App.jsx:376`), and the subline literal "מרכז בקרת משימות"
  (`App.jsx:377`) — `projectName` appears nowhere in the HTML, and the file is
  `דוח-סטטוס-<date>.html` (`App.jsx:387`).
- `buildWorkbook` accepts `projectName` (`excelWeb.js:24`) but writes it to no cell. Desktop
  `excel.js` `exportXlsx` does not even accept it (`excel.js:12`).

With single-project-per-file and ~2–6 files, every PDF/sheet across programs is titled
identically — a real board-mix-up hazard. **Win:** interpolate `projectName` into the report
`<title>`/`<h1>`/subline and filename; add a project-name header cell (merged row above the
column headers, or `ySplit: 2`) to the "משימות" sheet in **both** `excelWeb.js` and desktop
`excel.js` (thread the param through the desktop call site).

### 2.3 No by-controller (בקר) view / "לבדיקה שלי" (P1–P2, medium) — *CTO, manager*
Tasks carry `ctrl` and members carry `isController`, but no view filters on `t.ctrl`. There
are exactly two `FilterView` instances — by-person on `t.who` (`App.jsx:468`) and by-assembly
on `t.asm` (`App.jsx:474`). The report's "ממתינות לבדיקה" section is **global** across all
לבדיקה tasks (`App.jsx:324,339-344`), not scoped to a reviewer. A controller (the manager is
בקר on most tasks) cannot pull "everything waiting on ME." Data exists; view does not.
**Win:** a third `FilterView` with `options = members.filter(isController)` and items
`t.ctrl === value`; optionally a "לבדיקה שלי" chip combining `ctrl === me && status === "לבדיקה"`.
Reuses the existing component.

### 2.4 MembersModal counts include בוצע; no team-overview grid (P2–P3, small-medium) — *CTO, manager*
`taskCounts` counts **every** task per assignee with no status filter (`App.jsx:397-401`), so
the badge next to each member (`MembersModal.jsx:73`) and the remove-confirm
(`MembersModal.jsx:50-51`) are inflated by completed tasks. There is also no all-team grid —
a standup means clicking through each engineer (the by-person view is single-select,
defaulting to `m[0]?.name`, `App.jsx:93`, so it opens empty if member #1 owns nothing).
**Win (cheapest first):** make the count active-only (`status !== "בוצע"`) for both the badge
and the remove-confirm; default `filterPerson` to the highest-load member (`taskCounts` is
already computed). Then optionally a compact per-member active-by-status grid in the
SidePanel or an "all team" mode.

### 2.5 "תג״ב" due field has no plain-language hint (P2, trivial) — *junior*
`TaskModal.jsx:219` renders `<Field label="תג״ב">` with no `title` and no secondary
"תאריך יעד" label; the abbreviation propagates to cards, the report (`App.jsx:333`), and the
Excel header. A grep for "תאריך יעד" across `src` returns no matches. **Win:** add
`title="תאריך יעד (תאריך גמר בקרה)"` to the field or a small secondary sub-label. Trivial,
high onboarding payoff.

### 2.6 Excel import drops checklists/comments/attachments without disclosure (P2, trivial copy) — *lead*
`applyExcelImport` hardcodes `checklist:[], comments:[], attachments:[]` on every imported
task (`App.jsx:299`) — the workbook only ever carries a `done/total` checklist **summary**
string, never items (`excelWeb.js:40`; desktop the same). `ImportChoiceModal` discloses only
that "החלף הכל" deletes existing data (`App.jsx:558`); it never states that Excel does not
carry rich content, so a heavy week-one documenter loses it silently on replace / never gains
it on merge. **Win:** one line in `ImportChoiceModal` noting Excel does not carry
checklists/comments/attachments. Pure copy.

### 2.7 RTL swipe direction not mirrored (P3, small-medium) — *all*
`SwipeRow` maps `d >= THRESH` (rightward) → `onComplete` and `d <= -THRESH` (leftward) →
`onPostpone` (`SwipeRow.jsx:36-37`), with the green "בוצע" affordance on `dx>0` and postpone
on `dx<0` (`SwipeRow.jsx:47-51`). The whole UI is `dir="rtl"` (`App.jsx:420`) but the gesture
is not mirrored, so the consequential action sits on the less-intuitive side for a Hebrew
reader. Used by AgendaView and both filter lists. Mitigated by undo (toast + Ctrl+Z), so
**friction, not data loss**. **Win:** mirror for RTL (left = complete, right = postpone) and
swap the affordance sides to match, or expose a small setting.

---

## 3. Simplify / remove for week-one simplicity

Nothing warrants removal — re-confirmed. The TaskModal is long (it stacks title, מכלול,
status, priority, assignee, בקר, due, notes, Tags, Checklist, Attachments, CommentThread —
`TaskModal.jsx:177-237`), but every field is legitimate for the team use case and already
adjudicated in APP-REVIEW §3. The only meaningful simplification is **opt-in**: a "מצב פשוט"
disclosure that collapses tags/checklist/attachments/comments (and optionally בקר) behind a
"more" toggle, leaving the core fields. Cosmetic, lowest priority. This was *already_exists*
in APP-REVIEW's analysis — noted here only to confirm it remains the right call, not a defect.

---

## 4. Roadmap

### Now (small, ship together — fixes + cheap wins)
1. AssembliesModal → MembersModal blur-commit pattern (kills per-keystroke re-tag/audit spam
   + blank-key orphan). *(1.1)*
2. Excel import: detect real Date cells and convert via `dateToDue` in both import paths. *(1.2)*
3. SEED task #6 `ctrl: "איבצן"` → a real member. *(1.3)*
4. Duplicate-name guard on both rename commit paths. *(1.4)*
5. Thread `projectName` into report `<title>`/`<h1>`/subline/filename + a header cell in both
   Excel builders. *(2.2)*
6. "תאריך יעד" tooltip on the תג״ב field; one-line Excel-loses-rich-content note in the import
   modal. *(2.5, 2.6)*

### Next (low-medium effort, high value)
7. "פרויקט חדש / נקה נתוני דוגמה" action (export-first confirm, undo-backed). *(2.1)*
8. By-controller `FilterView` + "לבדיקה שלי" shortcut. *(2.3)*
9. Active-only member counts; default by-person to highest-load member; compact per-member
   team-overview grid. *(2.4)*
10. Mirror swipe gestures for RTL (or make configurable). *(2.7)*

### Later (architectural — roadmap, not defects)
11. Read-only multi-file portfolio rollup (ingest several exported JSON backups, which now
    carry `projectName` + assemblies) for combined overdue/blocker/workload — no write path,
    no per-file schema change. SPEC-deferred Phase 2; interim feasible now. *(CTO/manager)*
12. Optional task↔task / task↔procurement "blocked by" link, surfaced in the report's blockers
    section so a late רכש order reads as the cause of a תקוע task. *(manager)*
