@echo off
REM ============================================================
REM  Run Mission Control on Windows WITHOUT packaging an .exe
REM  (good for trying it quickly). Requires Node.js installed.
REM  Double-click this file.
REM ============================================================
setlocal
cd /d "%~dp0"

echo Installing dependencies (first run only, may take a minute)...
call npm install || goto :err
call npm run build:desktop || goto :err
cd desktop
call npm install || goto :err

echo Launching Mission Control...
call npx electron .
exit /b 0

:err
echo.
echo Failed to start. Please copy the messages above and send them over.
pause
exit /b 1
