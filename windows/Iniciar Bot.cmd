@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-bot-hidden.ps1"
if errorlevel 1 pause
endlocal
