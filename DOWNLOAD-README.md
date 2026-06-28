# Mission Control — Windows desktop app (download)

**File:** `MissionControl-Windows-x64.zip` (~98 MB) · **version 0.3.3**

1. Download the zip (click the file above, then **Download raw file**).
2. **Extract the whole folder** somewhere permanent (Desktop is fine).
3. Double-click **`Mission Control.exe`**.
4. First launch may show Windows SmartScreen → **More info → Run anyway** (unsigned app, one-time).
5. Your data is saved in **`mission-control.db`** next to the app — copy that file to back it up.

## What's new in 0.3.3
- מכלול rename no longer re-tags on every keystroke (commits once when you leave the field), and clearing the field no longer orphans tasks.
- Renaming a member/מכלול onto an existing name is blocked instead of silently merging.
- Excel import now reads real date cells in the תג"ב column correctly.
- The project name now appears in the status report and in exported Excel files.
- New **"פרויקט חדש / נקה נתוני דוגמה"** button (⋮ panel) to clear the demo data and start fresh — keeps your team and מכלולים, and is undoable.
- Fixed a seed-data inconsistency (a controller who wasn't a team member).

This branch only holds the build. The app source lives on `main` (see `desktop/`).
