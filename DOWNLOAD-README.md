# Mission Control — Windows desktop app (download)

**File:** `MissionControl-Windows-x64.zip` (~98 MB) · **version 0.3.5**

1. Download the zip (click the file above, then **Download raw file**).
2. **Extract the whole folder** somewhere permanent (Desktop is fine).
3. Double-click **`Mission Control.exe`**.
4. First launch may show Windows SmartScreen → **More info → Run anyway** (unsigned app, one-time).
5. Your data: `mission-control.db` + an `attachments` folder, both next to the app — copy the whole folder to back up.

## What's new in 0.3.5
- **You can now reach the files you attach.** Attachments are saved as real files in an `attachments` folder next to the app (no longer hidden inside the database). In each task, every attachment has **פתח** (open in the right program — PDF, CAD, etc.) and **הצג בתיקייה** (reveal) buttons. New menu item: **קובץ → פתח תיקיית קבצים מצורפים**. Existing attachments are moved out to files automatically on first launch.
- **Project documentation export.** ⋮ panel → **"ייצוא תיעוד פרויקט (ZIP)"** creates a zip with a full `report.html` (every task with notes, checklists, comments, and images shown inline) plus a `files/` folder containing all the attached documents (PDF, CAD, BOM…), linked from the report. Print the HTML to PDF for a shareable project record.

## Earlier
- 0.3.4 — smooth swipe animation in the filter list views.
- 0.3.3 — מכלול rename fix, duplicate-name guard, Excel date import, project name in reports/Excel, "clear demo data" action.

This branch only holds the build. The app source lives on `main` (see `desktop/`).
