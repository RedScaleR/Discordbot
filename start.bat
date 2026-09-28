@echo off
rem Double-click this to start Mochi :3
title Mochi
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto :no_node

node -e "const [a, b] = process.versions.node.split('.').map(Number); process.exit(a > 22 || (a === 22 && b >= 13) ? 0 : 1)"
if errorlevel 1 goto :old_node

if exist .env goto :install
echo First time setup! Paste your bot token and press Enter.
echo Get it at https://discord.com/developers/applications - your app - Bot - Reset Token
set "TOKEN="
set /p "TOKEN=Token: "
if not defined TOKEN goto :no_token
> .env echo DISCORD_TOKEN=%TOKEN%
echo Saved to .env :3

:install
rem Installs anything missing, like new packages that came with an update.
node tools\check-deps.js
if not errorlevel 1 goto :run
echo Installing Mochi's stuff...
call npm install --omit=dev
if errorlevel 1 goto :install_failed

:run
call npm start
echo.
echo Mochi stopped.
pause
exit /b 0

:no_node
echo Node.js isn't installed :( Get it from https://nodejs.org - version 22 or newer - then try again.
pause
exit /b 1

:old_node
echo Your Node.js is too old. Mochi needs version 22.13 or newer from https://nodejs.org
pause
exit /b 1

:no_token
echo No token given, so I can't start. Run me again when you have it!
pause
exit /b 1

:install_failed
echo Install failed. Check your internet connection and try again.
pause
exit /b 1
