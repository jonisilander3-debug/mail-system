@echo off
cd /d "%~dp0"
set "PATH=%PATH%;C:\Program Files\nodejs"

call npm.cmd run db:start
if errorlevel 1 exit /b 1

node src\worker.js
