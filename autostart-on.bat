@echo off
rem Makes Mochi start by itself every time you log in to Windows. autostart-off.bat undoes it.
chcp 65001 >nul
cd /d "%~dp0"

if not exist .env goto :setup_needed

rem Adds a shortcut to keep-running.bat in your Startup folder, set to open minimized.
set "MOCHI_DIR=%~dp0"
powershell -NoProfile -Command "$ErrorActionPreference = 'Stop'; $link = Join-Path ([Environment]::GetFolderPath('Startup')) 'Mochi.lnk'; $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($link); $shortcut.TargetPath = Join-Path $env:MOCHI_DIR 'keep-running.bat'; $shortcut.WorkingDirectory = $env:MOCHI_DIR; $shortcut.WindowStyle = 7; $shortcut.Description = 'Starts Mochi, the Discord bot'; $shortcut.Save()"
if errorlevel 1 goto :failed

echo.
echo Done! Mochi will start by itself every time you log in to Windows :3
echo It runs in a minimized window on your taskbar. Close that window to stop Mochi.
echo To turn this off, run autostart-off.bat
echo.
choice /m "Start Mochi now too"
if errorlevel 2 goto :end
start "Mochi" /min "%~dp0keep-running.bat"

:end
pause
exit /b 0

:setup_needed
echo Run start.bat once first, so Mochi can get your token and install its stuff :3
pause
exit /b 1

:failed
echo.
echo Couldn't add the shortcut. You can do it by hand instead:
echo   1. Right-click keep-running.bat and choose "Create shortcut"
echo   2. Press Windows key + R, type shell:startup and press Enter
echo   3. Move the new shortcut into the folder that opens
pause
exit /b 1
