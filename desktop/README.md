# Mission Control — Windows Desktop App

The exact same app as the web version, running as a local Windows program
(Electron) that stores everything in a **SQLite database file** in its own
folder. No internet, no account — your data never leaves the computer.

## Easiest way (recommended)

1. Install **Node.js (LTS)** once: https://nodejs.org
2. From the project's top folder, **double-click `build-windows-app.bat`**.
3. When it finishes, your app is at:
   `desktop\release\MissionControl-<version>-portable.exe`
4. Copy that `.exe` anywhere you like and double-click to run. It creates a
   `mission-control.db` file **next to itself** — that file *is* your data
   (back it up by copying it).

Just want to try it without building an `.exe`? Double-click
**`run-windows-app.bat`** instead.

## What gets stored where

A single SQLite file, `mission-control.db`, in the app's folder, with real
tables you can open in any SQLite tool (e.g. [DB Browser for SQLite](https://sqlitebrowser.org)):

| table | holds |
|---|---|
| `tasks` | tasks (nested tags/checklist/comments/attachment-list as JSON columns) |
| `members` | team members (+ `isController` flag) |
| `procurement` | procurement (בקרת רכש) rows |
| `audit_log` | the activity log |
| `attachments` | file/photo bytes (BLOB) |

The in-app **JSON backup** and **status report (HTML→PDF)** exports work here too.

## Manual build (if you prefer the command line)

```bash
# from the project root:
npm install
npm run build:desktop      # builds the UI into desktop/renderer

cd desktop
npm install                # Electron + sql.js
npm start                  # run it
npm run dist               # build desktop/release/...-portable.exe
```

## Notes

- Uses **sql.js** (SQLite compiled to WebAssembly) — pure JavaScript, so the
  build needs **no Visual Studio / C++ build tools**.
- The portable `.exe` keeps its database beside itself. If you instead install
  to `Program Files`, Windows may block writing there — prefer the portable build.
- This desktop project is separate from the website; building the site does not
  pull in Electron.
