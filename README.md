# Mission Control

A single-project engineering task manager (Hebrew, RTL). Kanban board, per-person
and per-assembly views, an AI-free MVP per `SPEC.md` — now with **project members**,
**file attachments**, and **photos**.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build to dist/
npm run preview  # serve the production build
```

No backend required — everything persists locally in the browser
(localStorage for tasks/members/log, IndexedDB for attachment binaries).

## What's in this MVP

**Core (from the prototype + spec)**
- Kanban board by status (בעבודה / תקוע / לבדיקה / בוצע) + by-person + by-assembly views.
- Live KPI counts per status.
- Add / edit / delete tasks (one shared modal, add & edit modes).
- Built-in **audit log** — every add/edit/delete recorded with timestamp and a
  field-level diff (old → new). Open with the 🕘 יומן button.
- Hebrew RTL, mobile-responsive.

**New in this version**
- 👥 **Project members** — add, rename, recolor, and remove team members from the
  *צוות* screen. Members drive the assignee/controller dropdowns; each gets a colored
  avatar. Removing a member who owns tasks asks for confirmation first.
- 📎 **File attachments on notes** — attach any document (PDF, BOM, CAD/STEP, etc.)
  to a task. Stored in IndexedDB so big files don't hit the localStorage quota.
- 🖼️ **Photos** — attach images; they render as thumbnails with a full-screen
  lightbox on click. Cards show a 📎 badge with the attachment count.
- 🔎 **Search** across task title, notes, people and assemblies.
- ⏰ **Overdue highlighting** — past-due dates on non-completed tasks turn red.
- ⬇️ ⬆️ **Backup** — export/import all tasks, members and the log as JSON.

## Data model & roadmap

See `SPEC.md` (data model, architecture, phased plan) and `CHANGELOG.md`
(decision log). This build is Phase 1 (browser storage, no AI); Phase 2 adds a
backend + multi-project, Phase 3 adds the server-side AI agent.

## Suggested next add-ons

Roughly in value order:

1. **Comments / activity thread per task** — discussion, not just the audit diff.
2. **Sub-tasks / checklists** inside a task.
3. **Dependencies** ("blocked by") + a simple timeline / Gantt view.
4. **Due-date calendar + reminders/notifications** for upcoming and overdue work.
5. **Tags / labels** beyond assembly (e.g. "מחכה לספק", "קריטי").
6. **Procurement (בקרת רכש) tab** — carried over from the original Excel workbook.
7. **Saved filters & sorting** (by priority, due date, assignee).
8. **Editable assemblies/config** in-app (currently fixed in code).
9. **Multi-project switcher** (Phase 2 in the spec).
10. **Server backend + auth** so attachments and data sync across devices, then the
    **AI command bar** (Phase 3) — the real differentiator.
