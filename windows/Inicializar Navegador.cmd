@echo off
setlocal
pushd "%~dp0"
node dist/init-browser.js
if errorlevel 1 pause
popd
endlocal
