# Mission Control — Windows desktop app (download)

**File:** `MissionControl-Windows-x64.zip` (~98 MB) · **version 0.3.4**

1. Download the zip (click the file above, then **Download raw file**).
2. **Extract the whole folder** somewhere permanent (Desktop is fine).
3. Double-click **`Mission Control.exe`**.
4. First launch may show Windows SmartScreen → **More info → Run anyway** (unsigned app, one-time).
5. Your data is saved in **`mission-control.db`** next to the app — copy that file to back it up.

## What's new in 0.3.4
- Swipe animation in the by-person / by-מכלול list views is now smooth — the card no longer jumps or lags behind the cursor while you drag it. It behaves exactly like the agenda (timeline) swipe.

## 0.3.3
- מכלול rename commits once when you leave the field (no per-keystroke re-tagging); clearing the field no longer orphans tasks.
- Renaming a member/מכלול onto an existing name is blocked instead of silently merging.
- Excel import reads real date cells in the תג"ב column correctly.
- Project name appears in the status report and in exported Excel files.
- New **"פרויקט חדש / נקה נתוני דוגמה"** button (⋮ panel) — clears demo data, keeps team and מכלולים, undoable.

This branch only holds the build. The app source lives on `main` (see `desktop/`).
