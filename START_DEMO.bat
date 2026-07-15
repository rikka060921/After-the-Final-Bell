@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found.
  echo Install Node.js 20.19 or newer, then run this file again.
  pause
  exit /b 1
)

node tools\serve.mjs --open
if errorlevel 1 (
  echo The demo could not start. Check whether port 8765 is already in use.
)
pause
