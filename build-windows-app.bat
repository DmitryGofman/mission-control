@echo off
REM ============================================================
REM  Build the Mission Control Windows desktop app (.exe)
REM  Requires Node.js installed: https://nodejs.org  (LTS)
REM  Double-click this file. When it finishes, the app is in:
REM     desktop\release\MissionControl-<version>-portable.exe
REM ============================================================
setlocal
cd /d "%~dp0"

echo [1/4] Installing web dependencies...
call npm install || goto :err

echo [2/4] Building the user interface...
call npm run build:desktop || goto :err

echo [3/4] Installing desktop dependencies (Electron)...
cd desktop
call npm install || goto :err

echo [4/4] Packaging the portable Windows app...
call npm run dist || goto :err

echo.
echo ============================================================
echo  Done!  Your app:  desktop\release\
echo  Copy the .exe anywhere and double-click it. It creates
echo  "mission-control.db" next to itself for your data.
echo ============================================================
pause
exit /b 0

:err
echo.
echo Build FAILED. Please copy the messages above and send them over.
pause
exit /b 1
