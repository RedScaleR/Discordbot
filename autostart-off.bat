@echo off
rem Stops Mochi from starting by itself when you log in to Windows.
chcp 65001 >nul

powershell -NoProfile -Command "$ErrorActionPreference = 'Stop'; $link = Join-Path ([Environment]::GetFolderPath('Startup')) 'Mochi.lnk'; if (Test-Path $link) { Remove-Item $link; Write-Host 'Done! Mochi will not start by itself anymore.' } else { Write-Host 'Mochi was not set to start by itself.' }"

echo If Mochi is running right now, close its window to stop it.
pause
