param(
  [Parameter(Mandatory=$false)][string]$Rpc = "https://sepolia.base.org",
  [Parameter(Mandatory=$true)][string]$PrivateKey
)

$ErrorActionPreference = "Stop"

function Step($m) { Write-Host "[GuessingGame] $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "[OK] $m" -ForegroundColor Green }
function Err($m)  { Write-Host "[ERR] $m" -ForegroundColor Red }

try {
  if (-not (Get-Command forge -ErrorAction SilentlyContinue)) { throw "Foundry 'forge' not found in PATH" }
  if (-not (Get-Command cast -ErrorAction SilentlyContinue))  { throw "Foundry 'cast' not found in PATH" }

  $repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
  $contractsDir = Join-Path $repoRoot "contracts"

  if (-not (Test-Path (Join-Path $contractsDir "src/GuessingGame.sol"))) { throw "contracts/src/GuessingGame.sol not found" }

  Step "Building"
  Push-Location $contractsDir
  & forge build | Write-Host
  if ($LASTEXITCODE -ne 0) { throw "forge build failed" }

  Step "Deploying GuessingGame"
  $deploy = & forge create src/GuessingGame.sol:GuessingGame --rpc-url $Rpc --private-key $PrivateKey 2>&1
  $deploy | Write-Host
  if ($LASTEXITCODE -ne 0) { throw "deploy failed" }
  $m = ($deploy | Select-String -Pattern "Deployed to:\s+(0x[0-9a-fA-F]{40})").Matches
  if ($m.Count -lt 1) { throw "could not parse address" }
  $ADDR = $m[0].Groups[1].Value
  Pop-Location

  Step "Starting first round"
  & cast send $ADDR "startNextRound()" --rpc-url $Rpc --private-key $PrivateKey | Write-Host
  if ($LASTEXITCODE -ne 0) { throw "startNextRound failed" }

  Ok "Deployed at $ADDR and round started"
  Write-Host "\nTo run UI:" -ForegroundColor Yellow
  Write-Host "  cd miniapp" -ForegroundColor Yellow
  Write-Host "  copy .env.example .env.local" -ForegroundColor Yellow
  Write-Host "  # set NEXT_PUBLIC_RPC_URL=$Rpc" -ForegroundColor Yellow
  Write-Host "  # set NEXT_PUBLIC_CONTRACT_ADDRESS=$ADDR" -ForegroundColor Yellow
  Write-Host "  npm install && npm run dev" -ForegroundColor Yellow
}
catch {
  Err $_
  exit 1
}

