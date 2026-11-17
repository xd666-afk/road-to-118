@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "node_modules" (
  echo Installing game dependencies...
  call npm install
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Starting Road to 118. Keep this window open while playing.
call npm run dev -- --open
pause
