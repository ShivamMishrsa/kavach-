# Runs the browser end-to-end checks in headless Edge or Chrome (Windows).
#   1. Demo flow on the in-browser mock: English flow + the regional languages.
#   2. Real flow against the backend (Tesseract + rules). Skipped, with a warning, when the
#      backend or Tesseract is not set up (see microservices/backend/README.md).
# Usage (from anywhere):  powershell -File microservices/tests/e2e/run.ps1 [-OutDir <folder>]
# Needs: Node 22+ and Microsoft Edge or Google Chrome.
# Add -Only flow,languages,perf,prerender,a11y,backend,accounts to run just those suites (default: all).
param([string]$OutDir = (Join-Path $env:TEMP 'kavach-e2e'), [string[]]$Only = @())

$ErrorActionPreference = 'Stop'
$microservices = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$frontend = Join-Path $microservices 'frontend'
$backend = Join-Path $microservices 'backend'
$backendPython = Join-Path $backend '.venv\Scripts\python.exe'
$notice = Join-Path $backend 'tests\fixtures\notice_en.png'
New-Item -ItemType Directory -Force $OutDir | Out-Null

$browser = @(
  "$env:ProgramFiles (x86)\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw 'Install Microsoft Edge or Google Chrome to run the e2e checks.' }

function Start-Hidden($file, $arguments, $directory) {
  Start-Process $file -ArgumentList $arguments -WorkingDirectory $directory -PassThru -WindowStyle Hidden
}

function Stop-Tree($process) {
  if (-not $process) { return }
  Get-CimInstance Win32_Process -Filter "ParentProcessId=$($process.Id)" |
    ForEach-Object { Stop-Tree (Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue) }
  Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
}

function Wanted($suite) { $Only.Count -eq 0 -or $Only -contains $suite }

$started = @()
$exit = 0
Push-Location $frontend
try {
  # ----- demo build (no backend) -----
  npm run build | Out-Null
  $started += Start-Hidden 'cmd.exe' @('/c', 'npx vite preview --port 4173 --strictPort') $frontend
  $started += Start-Process $browser -PassThru -ArgumentList '--headless=new', '--disable-gpu', '--remote-debugging-port=9222', "--user-data-dir=$(Join-Path $OutDir 'browser-profile')", 'about:blank'
  Start-Sleep -Seconds 7

  if (Wanted 'flow') {
    Write-Host '--- English demo flow ---'
    node (Join-Path $PSScriptRoot 'flow.mjs') $OutDir
    if ($LASTEXITCODE -ne 0) { $exit = 1 }
  }

  if (Wanted 'languages') {
    Write-Host '--- Regional languages (demo) ---'
    node (Join-Path $PSScriptRoot 'languages.mjs') $OutDir hi ta bn mr te gu
    if ($LASTEXITCODE -ne 0) { $exit = 1 }
  }

  if (Wanted 'perf') {
    Write-Host '--- Speed on a slow phone and network ---'
    node (Join-Path $PSScriptRoot 'perf.mjs') $OutDir
    if ($LASTEXITCODE -ne 0) { $exit = 1 }
  }

  if (Wanted 'prerender') {
    Write-Host '--- Public pages written out in advance ---'
    node (Join-Path $PSScriptRoot 'prerender.mjs') $OutDir
    if ($LASTEXITCODE -ne 0) { $exit = 1 }
  }

  if (Wanted 'a11y') {
    Write-Host '--- Accessibility (axe) ---'
    node (Join-Path $PSScriptRoot 'a11y.mjs') $OutDir
    if ($LASTEXITCODE -ne 0) { $exit = 1 }
  }

  # ----- real backend -----
  if (-not (Wanted 'backend') -and -not (Wanted 'accounts')) {
    # not asked for
  } elseif (-not (Test-Path $backendPython)) {
    Write-Warning 'SKIPPED: backend virtual environment not found (see microservices/backend/README.md).'
  } else {
    $env:KAVACH_CORS_ORIGINS = 'http://localhost:4174'
    $env:KAVACH_DATA_DIR = Join-Path $OutDir 'backend-data'
    $env:KAVACH_SITE_URL = 'http://localhost:4174'  # the sign-in links in the emails point here
    Remove-Item -Recurse -Force $env:KAVACH_DATA_DIR -ErrorAction SilentlyContinue  # start from nothing
    $server = Start-Hidden $backendPython @('-m', 'uvicorn', 'app.main:app', '--port', '8001') $backend
    $started += $server
    $ready = $false
    for ($i = 0; $i -lt 30 -and -not $ready; $i++) {
      Start-Sleep -Seconds 1
      try { $ready = (Invoke-RestMethod 'http://localhost:8001/health').ocr -eq 'ready' } catch { }
    }
    if (-not $ready) {
      Write-Warning 'SKIPPED: the backend did not start, or Tesseract (English + Hindi) is not ready.'
    } else {
      $env:VITE_API_URL = 'http://localhost:8001'
      npx vite build --outDir (Join-Path $OutDir 'dist-real') --emptyOutDir | Out-Null
      node scripts/prerender.mjs (Join-Path $OutDir 'dist-real') | Out-Null
      # The preview server writes the Content-Security-Policy from this variable, so it stays set.
      $started += Start-Hidden 'cmd.exe' @('/c', "npx vite preview --outDir `"$(Join-Path $OutDir 'dist-real')`" --port 4174 --strictPort") $frontend
      Remove-Item Env:VITE_API_URL
      Start-Sleep -Seconds 3
      if (Wanted 'backend') {
        Write-Host '--- Real backend: photo of a notice -> Hindi result ---'
        node (Join-Path $PSScriptRoot 'backend.mjs') $OutDir $notice
        if ($LASTEXITCODE -ne 0) { $exit = 1 }
      }

      if (Wanted 'accounts') {
        Write-Host '--- Real backend: accounts (emailed link, sync, export, delete) ---'
        node (Join-Path $PSScriptRoot 'accounts.mjs') $OutDir
        if ($LASTEXITCODE -ne 0) { $exit = 1 }
      }
    }
  }
} finally {
  foreach ($process in $started) { Stop-Tree $process }
  Pop-Location
}
Write-Host "Screenshots are in $OutDir"
exit $exit
