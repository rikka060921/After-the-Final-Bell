@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0\.."

where node >nul 2>&1
if errorlevel 1 (
  echo 未检测到 Node.js。请先安装 Node.js 20.19 或更高版本。
  echo 安装后重新双击这个文件即可启动试玩。
  pause
  exit /b 1
)

node tools\serve.mjs --open
pause
