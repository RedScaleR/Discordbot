@echo off
rem Updates Mochi from the newest mochi-bot zip in your Downloads folder, or drag a zip onto this file.
rem Your token, settings and data are never touched. The command below is one line on purpose:
rem this file can get replaced while it runs, and Windows would get confused by a changed file.
title Update Mochi & chcp 65001 >nul & powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\update.ps1" "%~1" & pause & exit /b
