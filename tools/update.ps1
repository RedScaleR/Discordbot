# Updates Mochi from a mochi-bot zip. Run it with Update-Mochi.bat.
# Your token (.env), settings (config.json), data folder and my-commands folder are never touched.
# (Kept to plain ASCII on purpose: older Windows PowerShell misreads other characters.)
param([string]$ZipPath)

$ErrorActionPreference = 'Stop'
$MochiDir = Split-Path -Parent $PSScriptRoot
$KeepNames = @('.env', 'config.json', 'data', 'node_modules', 'my-commands', '.git')

function Say([string]$Text, [string]$Color = 'Gray') { Write-Host $Text -ForegroundColor $Color }

function Ask-Yes([string]$Question) {
    $answer = Read-Host "$Question (y/n)"
    return $answer -match '^\s*y'
}

function Read-Version([string]$Folder) {
    $file = Join-Path $Folder 'package.json'
    if (-not (Test-Path $file)) { return $null }
    return (Get-Content -Raw -Path $file | ConvertFrom-Json)
}

function Find-Zip {
    if ($ZipPath) {
        if (Test-Path $ZipPath) { return (Resolve-Path $ZipPath).Path }
        throw "Can't find the file $ZipPath"
    }
    $downloads = $null
    try { $downloads = (New-Object -ComObject Shell.Application).NameSpace('shell:Downloads').Self.Path } catch { }
    if (-not $downloads) { $downloads = Join-Path $HOME 'Downloads' }
    $zip = Get-ChildItem -Path $downloads -Filter 'mochi-bot*.zip' -File -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($zip) { return $zip.FullName }
    return $null
}

function Get-DashboardPort {
    $envFile = Join-Path $MochiDir '.env'
    if (Test-Path $envFile) {
        foreach ($line in Get-Content $envFile) {
            if ($line -match '^\s*DASHBOARD_PORT\s*=\s*(\d+)') { return [int]$Matches[1] }
        }
    }
    return 3000
}

function Test-MochiRunning {
    try {
        $status = Invoke-RestMethod -Uri "http://127.0.0.1:$(Get-DashboardPort)/api/status" -TimeoutSec 2
        return [bool]$status.version
    } catch {
        return $false
    }
}

function Backup-Data([string]$Version) {
    $dataDir = Join-Path $MochiDir 'data'
    $files = @(Get-ChildItem -Path $dataDir -Filter 'mochi.db*' -File -ErrorAction SilentlyContinue)
    $config = Join-Path $MochiDir 'config.json'
    if (-not $files.Count -and -not (Test-Path $config)) { return $null }

    $backups = Join-Path $dataDir 'backups'
    $target = Join-Path $backups ((Get-Date -Format 'yyyy-MM-dd_HHmmss') + "_v$Version")
    New-Item -ItemType Directory -Path $target -Force | Out-Null
    foreach ($file in $files) { Copy-Item -Path $file.FullName -Destination $target }
    if (Test-Path $config) { Copy-Item -Path $config -Destination $target }

    # Only keep the 5 newest backups.
    Get-ChildItem -Path $backups -Directory | Sort-Object Name -Descending | Select-Object -Skip 5 |
        ForEach-Object { Remove-Item -Path $_.FullName -Recurse -Force }
    return $target
}

function Show-Changes([string]$Folder, [string]$Version) {
    $log = Join-Path $Folder 'CHANGELOG.md'
    if (-not (Test-Path $log)) { return }
    $printing = $false
    foreach ($line in Get-Content $log) {
        if ($line -match '^## ') {
            if ($printing) { break }
            $printing = $line -match [regex]::Escape($Version)
            if ($printing) { Say "What's new in v${Version}:" 'Magenta' }
            continue
        }
        if ($printing -and $line.Trim()) { Say "  $line" }
    }
}

$temp = $null
$stage = 'prepare'   # prepare -> copy -> install
try {
    Say ''
    Say '  Mochi updater :3' 'Magenta'
    Say ''

    $current = Read-Version $MochiDir
    if (-not $current -or $current.name -ne 'mochi-bot') { throw "This doesn't look like a Mochi folder: $MochiDir" }

    $zip = Find-Zip
    if (-not $zip) {
        Say "I couldn't find a mochi-bot zip in your Downloads folder." 'Yellow'
        Say 'Download the newest one, or drag the zip onto Update-Mochi.bat.'
        exit 1
    }
    Say "Using $zip"

    # Unpack into a temporary folder first, so nothing changes if the zip is bad.
    $temp = Join-Path ([IO.Path]::GetTempPath()) ('mochi-update-' + [guid]::NewGuid())
    Expand-Archive -Path $zip -DestinationPath $temp
    $source = $temp
    if (-not (Test-Path (Join-Path $temp 'package.json'))) {
        # Older zips had everything inside a mochi-bot folder.
        $inner = Get-ChildItem -Path $temp -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'package.json') } | Select-Object -First 1
        if ($inner) { $source = $inner.FullName }
    }
    $incoming = Read-Version $source
    if (-not $incoming -or $incoming.name -ne 'mochi-bot' -or -not (Test-Path (Join-Path $source 'src'))) {
        throw "That zip doesn't look like Mochi: $zip"
    }

    Say "You have v$($current.version). The zip has v$($incoming.version)."
    if ([version]$incoming.version -le [version]$current.version) {
        if (-not (Ask-Yes 'That is not newer than what you have. Install it anyway?')) { Say 'Okay, nothing changed.'; exit 0 }
    }

    while (Test-MochiRunning) {
        Say ''
        Say 'Mochi is running right now. Close its window (look on your taskbar), then press Enter.' 'Yellow'
        Read-Host | Out-Null
        Start-Sleep -Seconds 1
    }

    $backup = Backup-Data $current.version
    if ($backup) { Say "Backed up your data and settings to $backup" }

    $stage = 'copy'
    # src is replaced completely, so files removed in the new version don't linger around.
    $newSrc = Join-Path $MochiDir 'src.new'
    $oldSrc = Join-Path $MochiDir 'src.old'
    foreach ($leftover in @($newSrc, $oldSrc)) { if (Test-Path $leftover) { Remove-Item -Path $leftover -Recurse -Force } }
    Copy-Item -Path (Join-Path $source 'src') -Destination $newSrc -Recurse
    if (Test-Path (Join-Path $MochiDir 'src')) { Rename-Item -Path (Join-Path $MochiDir 'src') -NewName 'src.old' }
    Rename-Item -Path $newSrc -NewName 'src'
    Remove-Item -Path $oldSrc -Recurse -Force -ErrorAction SilentlyContinue

    foreach ($item in Get-ChildItem -Path $source -Force) {
        if ($item.Name -eq 'src' -or $KeepNames -contains $item.Name) { continue }
        Copy-Item -Path $item.FullName -Destination $MochiDir -Recurse -Force
    }
    $stage = 'install'

    Say 'Installing anything new Mochi needs...'
    Push-Location $MochiDir
    try {
        & npm install --omit=dev --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw 'npm install failed' }
    } finally {
        Pop-Location
    }

    Say ''
    Say "  Mochi is updated to v$($incoming.version)! (^_^)" 'Green'
    Say ''
    Show-Changes $MochiDir $incoming.version
    Say ''

    if (Ask-Yes 'Start Mochi now?') {
        $startup = [Environment]::GetFolderPath('Startup')
        if ($startup -and (Test-Path (Join-Path $startup 'Mochi.lnk'))) {
            Start-Process -FilePath (Join-Path $MochiDir 'keep-running.bat') -WorkingDirectory $MochiDir -WindowStyle Minimized
        } else {
            Start-Process -FilePath (Join-Path $MochiDir 'start.bat') -WorkingDirectory $MochiDir
        }
    }
    exit 0
} catch {
    Say ''
    Say "Update failed: $($_.Exception.Message)" 'Red'
    if ($stage -eq 'prepare') {
        Say 'Nothing was changed.' 'Yellow'
    } elseif ($stage -eq 'copy') {
        # Put the old code back if we got partway through swapping it.
        $oldSrc = Join-Path $MochiDir 'src.old'
        if ((Test-Path $oldSrc) -and -not (Test-Path (Join-Path $MochiDir 'src'))) { Rename-Item -Path $oldSrc -NewName 'src' }
        Say 'Some files may be half-updated. Run Update-Mochi.bat again to finish.' 'Yellow'
        Say 'Your token, settings and data were not touched.' 'Yellow'
    } else {
        Say "Mochi's files are updated, but installing its packages failed." 'Yellow'
        Say 'Check your internet connection, then run Update-Mochi.bat again.' 'Yellow'
    }
    exit 1
} finally {
    if ($temp -and (Test-Path $temp)) { Remove-Item -Path $temp -Recurse -Force -ErrorAction SilentlyContinue }
}
