# Installs the StalklyProfile Vencord plugin: clones Vencord (or updates it if
# already cloned), copies this plugin into it, builds, and patches your chosen
# Discord branch to load that build. Run this from PowerShell:
#
#   .\install.ps1
#   .\install.ps1 -Branch canary        # skip the menu, patch Canary directly
#
# Prerequisites (these are Vencord's own requirements, not this script's):
#   - git      https://git-scm.com/downloads
#   - Node.js  https://nodejs.org (LTS)
#   - pnpm     run: npm install -g pnpm

param(
    [string]$VencordDir = "$env:USERPROFILE\Desktop\Vencord",
    [ValidateSet("auto", "stable", "ptb", "canary")]
    [string]$Branch
)

$ErrorActionPreference = "Stop"

function Require-Command($name, $hint) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        Write-Host "Missing prerequisite: $name" -ForegroundColor Red
        Write-Host "  $hint" -ForegroundColor Yellow
        exit 1
    }
}

function Select-Branch {
    $options = @(
        @{ Key = "1"; Branch = "stable"; Label = "Stable";        Note = "the default Discord client most people use" },
        @{ Key = "2"; Branch = "ptb";    Label = "PTB";            Note = "Public Test Build" },
        @{ Key = "3"; Branch = "canary"; Label = "Canary";         Note = "nightly build, most unstable" },
        @{ Key = "4"; Branch = "auto";   Label = "Auto-detect";    Note = "let the installer figure out which one you have" }
    )

    Write-Host ""
    Write-Host "Which Discord branch do you want to patch?" -ForegroundColor Cyan
    foreach ($opt in $options) {
        Write-Host ("  [{0}] {1,-12} {2}" -f $opt.Key, $opt.Label, $opt.Note)
    }

    $answer = Read-Host "Enter choice [1-4] (Enter = Stable)"
    if ([string]::IsNullOrWhiteSpace($answer)) { return "stable" }

    $match = $options | Where-Object { $_.Key -eq $answer.Trim() -or $_.Branch -eq $answer.Trim().ToLower() }
    if (-not $match) {
        Write-Host "Didn't recognize '$answer', defaulting to Stable." -ForegroundColor Yellow
        return "stable"
    }
    return $match.Branch
}

Require-Command git "Install from https://git-scm.com/downloads"
Require-Command node "Install the LTS build from https://nodejs.org"
Require-Command pnpm "Run: npm install -g pnpm"

if (-not $Branch) {
    $Branch = Select-Branch
}
Write-Host "Target branch: $Branch" -ForegroundColor Cyan

$PluginSrc = Join-Path $PSScriptRoot "src\userplugins\stalklyProfile"
if (-not (Test-Path $PluginSrc)) {
    Write-Host "Could not find plugin source at $PluginSrc" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $VencordDir)) {
    Write-Host "Cloning Vencord into $VencordDir ..." -ForegroundColor Cyan
    git clone https://github.com/Vendicated/Vencord.git $VencordDir
} else {
    Write-Host "Vencord already present at $VencordDir, pulling latest..." -ForegroundColor Cyan
    git -C $VencordDir pull
}

$Dest = Join-Path $VencordDir "src\userplugins\stalklyProfile"
New-Item -ItemType Directory -Force -Path $Dest | Out-Null
Copy-Item -Path (Join-Path $PluginSrc "*") -Destination $Dest -Recurse -Force

Set-Location $VencordDir

Write-Host "Installing dependencies..." -ForegroundColor Cyan
pnpm install

Write-Host "Building..." -ForegroundColor Cyan
pnpm build

Write-Host "Patching Discord ($Branch)..." -ForegroundColor Cyan
node scripts/runInstaller.mjs -- -install -branch $Branch

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "1. Quit Discord completely (system tray, not just close the window) and reopen it." -ForegroundColor Green
Write-Host "2. Settings > Vencord > Plugins > StalklyProfile > enable it." -ForegroundColor Green
Write-Host "3. Paste your own API key (get one at https://stalkly.me/dashboard/api) into its apiKey setting." -ForegroundColor Green
Write-Host ""
Write-Host "To update later: re-run this script (e.g. '.\install.ps1 -Branch $Branch' to skip the menu)," -ForegroundColor Green
Write-Host "or just edit files in $Dest and run 'pnpm build' inside $VencordDir." -ForegroundColor Green
