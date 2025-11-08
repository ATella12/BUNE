param(
  [Parameter(Mandatory=$false)][string]$Rpc = "http://127.0.0.1:8545",
  [Parameter(Mandatory=$true)][string]$PrivateKey
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "[BuneLite] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "[OK]  $msg" -ForegroundColor Green }
function Write-Err($msg)  { Write-Host "[ERR] $msg" -ForegroundColor Red }

try {
  if (-not (Get-Command forge -ErrorAction SilentlyContinue)) { throw "Foundry 'forge' not found in PATH" }

  $repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
  $contractsDir = Join-Path $repoRoot "contracts"
  $webDir = Join-Path $repoRoot "web"

  if (-not (Test-Path (Join-Path $contractsDir "src/BuneLite.sol"))) { throw "BuneLite.sol missing" }

  Write-Step "Building"
  Push-Location $contractsDir
  & forge build | Write-Host
  if ($LASTEXITCODE -ne 0) { throw "forge build failed" }

  Write-Step "Deploying BuneLite"
  $deploy = & forge create src/BuneLite.sol:BuneLite --rpc-url $Rpc --private-key $PrivateKey 2>&1
  $deploy | Write-Host
  if ($LASTEXITCODE -ne 0) { throw "Deploy failed" }
  $m = ($deploy | Select-String -Pattern "Deployed to:\s+(0x[0-9a-fA-F]{40})").Matches
  if ($m.Count -lt 1) { throw "Could not parse address" }
  $BUNE_ADDR = $m[0].Groups[1].Value
  Pop-Location

  if (-not (Test-Path $webDir)) { New-Item -ItemType Directory -Path $webDir | Out-Null }
  $cfgPath = Join-Path $webDir "config-lite.js"
  $cfg = @"
window.BUNE_LITE_CONFIG = {
  rpcUrl: "$Rpc",
  chainId: 31337,
  bune: "$BUNE_ADDR",
};
"@
  $cfg | Set-Content -Path $cfgPath -Encoding UTF8
  Write-Ok "Wrote $cfgPath"

  Write-Host "\nBuneLite deployed at $BUNE_ADDR" -ForegroundColor Yellow
  Write-Host "Next: run .\\scripts\\serve-web.ps1 and open /lite.html" -ForegroundColor Yellow
}
catch {
  Write-Err $_
  exit 1
}

