@echo off
setlocal
if not exist "%~dp0logs\bot.log" (
  echo Todavia no existe logs\bot.log
  pause
  exit /b 0
)
start "" notepad "%~dp0logs\bot.log"
if exist "%~dp0logs\bot-error.log" start "" notepad "%~dp0logs\bot-error.log"
endlocal
