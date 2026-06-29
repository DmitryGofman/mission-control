# Mission Control — Windows desktop app (download)

**File:** `MissionControl-Windows-x64.zip` (~98 MB) · **version 0.3.6**

1. Download the zip (click the file above, then **Download raw file**).
2. **Extract the whole folder** somewhere permanent (Desktop is fine).
3. Double-click **`Mission Control.exe`**.
4. First launch may show Windows SmartScreen → **More info → Run anyway** (unsigned app, one-time).
5. Your data: `mission-control.db` + an `attachments` folder, both next to the app — copy the whole folder to back up.

## Fixed in 0.3.6
- **Fixed the white-screen / instant crash on launch.** The app now opens correctly to its dark UI. (The bundle was being blocked by a browser security rule when loaded from disk; that's resolved.)
- **The app now has its logo** — the `Mission Control.exe` icon shows in Explorer and the taskbar.

## Earlier
- 0.3.5 — attachments saved as real files (open / reveal) + project documentation ZIP export.
- 0.3.4 — smooth swipe animation in the filter list views.
- 0.3.3 — מכלול rename fix, duplicate-name guard, Excel date import, project name in reports/Excel, "clear demo data".

This branch only holds the build. The app source lives on `main` (see `desktop/`).
