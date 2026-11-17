param(
    [string]$VsixPath = "",
    [string]$Target = "Auto"
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "   Antigravity Token Monitor - One-Click Extension Installer   " -ForegroundColor Cyan
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Locate or verify .vsix package
if ([string]::IsNullOrWhiteSpace($VsixPath)) {
    $foundVsix = Get-ChildItem -Path $PSScriptRoot -Filter "antigravity-token-monitor-*.vsix" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($null -eq $foundVsix) {
        Write-Warning "No .vsix package found in current directory. Attempting automatic build..."
        Push-Location $PSScriptRoot
        try {
            npm run package
            $foundVsix = Get-ChildItem -Path $PSScriptRoot -Filter "antigravity-token-monitor-*.vsix" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        } finally {
            Pop-Location
        }
    }

    if ($null -eq $foundVsix) {
        Write-Error "No .vsix package found. Please run 'npm run package' first."
        exit 1
    }
    $targetVsix = $foundVsix.FullName
} else {
    if (-not (Test-Path $VsixPath)) {
        Write-Error "Specified .vsix file does not exist: $VsixPath"
        exit 1
    }
    $targetVsix = (Get-Item $VsixPath).FullName
}

Write-Host "[1/3] Target Extension Package: $targetVsix" -ForegroundColor Green
$vsixItem = Get-Item $targetVsix
Write-Host ("      Size: " + [math]::Round($vsixItem.Length / 1KB, 2) + " KB") -ForegroundColor Gray
Write-Host ("      Modified: " + $vsixItem.LastWriteTime) -ForegroundColor Gray
Write-Host ""

# 2. Detect IDE and Install
Write-Host "[2/3] Detecting available IDEs and installing extension..." -ForegroundColor Yellow

$installedTargets = New-Object System.Collections.ArrayList

function Install-ExtensionCli {
    param(
        [string]$CliName,
        [string]$DisplayName
    )

    $cmd = Get-Command $CliName -ErrorAction SilentlyContinue
    if ($null -ne $cmd) {
        Write-Host ("  -> Detected " + $DisplayName + " (" + $cmd.Source + "), installing...") -ForegroundColor Cyan
        try {
            & $CliName --install-extension $targetVsix --force
            Write-Host ("  [OK] Successfully installed to " + $DisplayName + "!") -ForegroundColor Green
            return $true
        } catch {
            Write-Warning ("  [FAIL] Failed to install to " + $DisplayName + ": " + $_)
            return $false
        }
    }
    return $false
}

$localApp = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::LocalApplicationData)
$antigravityExe = Join-Path $localApp "Programs\antigravity\Antigravity.exe"

if ($Target -eq "Auto" -or $Target -eq "Antigravity") {
    $ok = Install-ExtensionCli -CliName "antigravity" -DisplayName "Antigravity CLI"
    if ($ok) {
        [void]$installedTargets.Add("Antigravity CLI")
    } elseif (Test-Path $antigravityExe) {
        Write-Host ("  -> Detected Antigravity.exe: " + $antigravityExe) -ForegroundColor Cyan
        try {
            $p = Start-Process -FilePath $antigravityExe -ArgumentList @("--install-extension", ('"' + $targetVsix + '"'), "--force") -NoNewWindow -PassThru -Wait
            if ($p.ExitCode -eq 0) {
                Write-Host "  [OK] Successfully installed via Antigravity.exe!" -ForegroundColor Green
                [void]$installedTargets.Add("Antigravity IDE")
            }
        } catch {
            Write-Host "  Antigravity IDE has no standalone CLI install endpoint, routing to VS Code / Cursor extension host." -ForegroundColor Gray
        }
    }
}

if ($Target -eq "Auto" -or $Target -eq "VSCode") {
    $ok = Install-ExtensionCli -CliName "code" -DisplayName "Visual Studio Code"
    if ($ok) {
        [void]$installedTargets.Add("VS Code")
    }
}

if ($Target -eq "Auto" -or $Target -eq "Cursor") {
    $ok = Install-ExtensionCli -CliName "cursor" -DisplayName "Cursor IDE"
    if ($ok) {
        [void]$installedTargets.Add("Cursor")
    }
}

Write-Host ""
# 3. Output configuration recommendations
Write-Host "[3/3] Extension Configuration and Quick Start Guide" -ForegroundColor Yellow

$userHome = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::UserProfile)
$defaultSessionRoot = Join-Path $userHome ".gemini\antigravity"
$escapedRoot = $defaultSessionRoot.Replace("\", "\\")

Write-Host ("  - Default Session Root: " + $defaultSessionRoot) -ForegroundColor Gray
Write-Host "  - ProcessLocator Detection: Active (Windows Netstat and Port Heartbeat Enabled)" -ForegroundColor Gray
Write-Host ""
Write-Host "Recommended VS Code / Antigravity User Settings (settings.json):" -ForegroundColor White

Write-Host "{" -ForegroundColor DarkCyan
Write-Host ('  "antigravity-token-monitor.sessionRoot": "' + $escapedRoot + '",') -ForegroundColor DarkCyan
Write-Host '  "antigravity-token-monitor.useRpcExport": true,' -ForegroundColor DarkCyan
Write-Host '  "antigravity-token-monitor.pollIntervalMs": 60000,' -ForegroundColor DarkCyan
Write-Host '  "antigravity-token-monitor.debug": false' -ForegroundColor DarkCyan
Write-Host "}" -ForegroundColor DarkCyan
Write-Host ""

if ($installedTargets.Count -gt 0) {
    $joined = $installedTargets -join ", "
    Write-Host "===============================================================" -ForegroundColor Green
    Write-Host (" Installation Completed! Successfully integrated into: " + $joined) -ForegroundColor Green
    Write-Host " Open the Command Palette (Ctrl+Shift+P) in your editor and run:" -ForegroundColor Green
    Write-Host "   > Antigravity Token Monitor: Open Dashboard" -ForegroundColor Yellow
    Write-Host " Or click the Activity Bar graph icon to view real-time token usage!" -ForegroundColor Green
    Write-Host "===============================================================" -ForegroundColor Green
} else {
    Write-Warning "No automatic CLI found. In VS Code or Cursor, click Extensions -> '...' -> 'Install from VSIX...' and select the package."
}
