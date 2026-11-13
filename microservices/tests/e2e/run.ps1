# Runs the browser end-to-end checks against the production build, in headless Edge or Chrome.
# Usage (from anywhere):  powershell -File microservices/tests/e2e/run.ps1 [-OutDir <folder>]
# Needs: Node 22+, a built frontend (this script builds it), and Microsoft Edge or Google Chrome.
param([string]$OutDir = (Join-Path $env:TEMP 'kavach-e2e'))

$ErrorActionPreference = 'Stop'
$frontend = (Resolve-Path (Join-Path $PSScriptRoot '..\..\frontend')).Path
New-Item -ItemType Directory -Force $OutDir | Out-Null

$browser = @(
  "$env:ProgramFiles (x86)\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw 'Install Microsoft Edge or Google Chrome to run the e2e checks.' }

Push-Location $frontend
npm run build | Out-Null
$server = Start-Process cmd.exe -ArgumentList '/c', 'npx vite preview --port 4173 --strictPort' -WorkingDirectory $frontend -PassThru -WindowStyle Hidden
$profileDir = Join-Path $OutDir 'browser-profile'
$engine = Start-Process $browser -ArgumentList '--headless=new', '--disable-gpu', '--remote-debugging-port=9222', "--user-data-dir=$profileDir", 'about:blank' -PassThru
Start-Sleep -Seconds 7

$exit = 0
try {
  Write-Host '--- English end-to-end flow ---'
  node (Join-Path $PSScriptRoot 'flow.mjs') $OutDir
  if ($LASTEXITCODE -ne 0) { $exit = 1 }

  Write-Host '--- Regional languages ---'
  node (Join-Path $PSScriptRoot 'languages.mjs') $OutDir hi ta bn mr te gu
  if ($LASTEXITCODE -ne 0) { $exit = 1 }
} finally {
  Stop-Process -Id $engine.Id -Force -ErrorAction SilentlyContinue
  Get-CimInstance Win32_Process |
    Where-Object { $_.CommandLine -match 'vite' -and $_.CommandLine -match '4173' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
  Pop-Location
}
Write-Host "Screenshots are in $OutDir"
exit $exit
