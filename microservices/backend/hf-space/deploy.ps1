# Sends the Kavach API to a free Hugging Face Docker Space (see docs/deploy.md, "Free demo").
#   powershell -File microservices\backend\hf-space\deploy.ps1 -Space yourname/kavach-api
# -DryRun only builds the folder to be sent and lists it. git asks for your Hugging Face user name
# and, as the password, an access token with write permission.
param(
    [Parameter(Mandatory = $true)][string]$Space,
    [switch]$DryRun
)

$backend = Split-Path $PSScriptRoot -Parent
$work = Join-Path $env:TEMP 'kavach-space'
if (Test-Path $work) { Remove-Item -Recurse -Force $work }
New-Item -ItemType Directory $work | Out-Null

Copy-Item (Join-Path $backend 'requirements.txt') $work
robocopy (Join-Path $backend 'app') (Join-Path $work 'app') /E /XD __pycache__ /NFL /NDL /NJH /NJS | Out-Null
Copy-Item (Join-Path $PSScriptRoot 'Dockerfile') $work
Copy-Item (Join-Path $PSScriptRoot 'README.md') $work

if ($DryRun) {
    Get-ChildItem $work -Recurse -File | ForEach-Object { $_.FullName.Substring($work.Length + 1) }
    return
}

git -C $work init -q -b main
git -C $work add -A
git -C $work -c user.name='Kavach deploy' -c user.email='deploy@localhost' commit -q -m 'Deploy the Kavach API'
git -C $work push --force "https://huggingface.co/spaces/$Space" main
if ($LASTEXITCODE -ne 0) { throw 'The push failed: check the Space name, user name and token.' }
Write-Host "Sent. Watch the build in the Space's Logs tab: https://huggingface.co/spaces/$Space"
