@echo off
rem Runs Mochi and starts it again if it stops unexpectedly, like when the internet
rem isn't connected yet right after Windows starts. autostart-on.bat makes Windows run this.
title Mochi
chcp 65001 >nul
cd /d "%~dp0"

if not exist .env goto :setup_needed

:deps
rem Installs anything missing, like new packages that came with an update.
node tools\check-deps.js
if not errorlevel 1 goto :run
call npm install --omit=dev
if not errorlevel 1 goto :run
echo.
echo Couldn't install Mochi's stuff, maybe the internet isn't connected yet. Trying again in 30 seconds...
timeout /t 30 /nobreak >nul
goto :deps

:run
node --disable-warning=ExperimentalWarning src\index.js
rem 3 = already running, 2 = needs fixing, 1 = worth trying again, 0 = stopped on purpose
if errorlevel 3 exit /b 0
if errorlevel 2 goto :needs_fixing
if not errorlevel 1 exit /b 0
echo.
echo Mochi stopped unexpectedly. Starting again in 15 seconds... close this window to stop Mochi.
timeout /t 15 /nobreak >nul
goto :run

:needs_fixing
echo.
echo Mochi can't start until the problem above is fixed. Fix it, then run start.bat.
pause
exit /b 1

:setup_needed
echo Run start.bat once first, so Mochi can get your token and install its stuff :3
pause
exit /b 1
