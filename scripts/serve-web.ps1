param([Parameter(Mandatory=$false)][int]$Port = 3000)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$webDir = Join-Path $repoRoot "web"
if (-not (Test-Path $webDir)) { throw "web dir not found at $webDir" }

Write-Host "Serving $webDir on http://localhost:$Port" -ForegroundColor Cyan

if (Get-Command npx -ErrorAction SilentlyContinue) {
  & npx --yes serve "$webDir" -l $Port
} else {
  if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw "Neither npx nor python found" }
  Push-Location $repoRoot
  & python -m http.server $Port -d "$webDir"
  Pop-Location
}

