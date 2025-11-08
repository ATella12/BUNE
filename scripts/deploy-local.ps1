param(
  [Parameter(Mandatory=$false)][string]$Rpc = "http://127.0.0.1:8545",
  [Parameter(Mandatory=$true)][string]$PrivateKey,
  [Parameter(Mandatory=$true)][string]$Treasury,
  [Parameter(Mandatory=$false)][int]$EntryAmount = 300000, # 0.30 with 6 decimals
  [Parameter(Mandatory=$false)][int]$FeeBps = 2000,        # 20%
  [Parameter(Mandatory=$false)][long]$MintAmount = 1000000000000 # 1,000,000 USDC (6 decimals)
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "[Bune] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "[OK]  $msg" -ForegroundColor Green }
function Write-Err($msg)  { Write-Host "[ERR] $msg" -ForegroundColor Red }

try {
  if (-not (Get-Command forge -ErrorAction SilentlyContinue)) { throw "Foundry 'forge' not found in PATH" }
  if (-not (Get-Command cast -ErrorAction SilentlyContinue))  { throw "Foundry 'cast' not found in PATH" }

  $repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
  $contractsDir = Join-Path $repoRoot "contracts"
  $webDir = Join-Path $repoRoot "web"

  if (-not (Test-Path $contractsDir)) { throw "Contracts dir not found at $contractsDir" }
  if (-not (Test-Path (Join-Path $contractsDir "src/BuneGame.sol"))) { throw "BuneGame.sol missing in contracts/src" }
  if (-not (Test-Path (Join-Path $contractsDir "src/MockUSDC.sol"))) { throw "MockUSDC.sol missing in contracts/src" }

  Write-Step "Building contracts"
  Push-Location $contractsDir
  & forge build | Write-Host
  if ($LASTEXITCODE -ne 0) { throw "forge build failed" }

  Write-Step "Deploying MockUSDC"
  $deployUsdc = & forge create src/MockUSDC.sol:MockUSDC --rpc-url $Rpc --private-key $PrivateKey 2>&1
  $deployUsdc | Write-Host
  if ($LASTEXITCODE -ne 0) { throw "Deploy MockUSDC failed" }
  $usdcMatch = ($deployUsdc | Select-String -Pattern "Deployed to:\s+(0x[0-9a-fA-F]{40})").Matches
  if ($usdcMatch.Count -lt 1) { throw "Could not parse MockUSDC address" }
  $USDC_ADDR = $usdcMatch[0].Groups[1].Value
  Write-Ok "USDC deployed at $USDC_ADDR"

  Write-Step "Minting $MintAmount to $Treasury"
  & cast send $USDC_ADDR "mint(address,uint256)" $Treasury $MintAmount --rpc-url $Rpc --private-key $PrivateKey | Write-Host
  if ($LASTEXITCODE -ne 0) { throw "Mint failed" }

  Write-Step "Deploying BuneGame (entry=$EntryAmount, feeBps=$FeeBps, treasury=$Treasury)"
  $deployBune = & forge create src/BuneGame.sol:BuneGame --constructor-args $USDC_ADDR $EntryAmount $FeeBps $Treasury --rpc-url $Rpc --private-key $PrivateKey 2>&1
  $deployBune | Write-Host
  if ($LASTEXITCODE -ne 0) { throw "Deploy BuneGame failed" }
  $buneMatch = ($deployBune | Select-String -Pattern "Deployed to:\s+(0x[0-9a-fA-F]{40})").Matches
  if ($buneMatch.Count -lt 1) { throw "Could not parse BuneGame address" }
  $BUNE_ADDR = $buneMatch[0].Groups[1].Value
  Write-Ok "BuneGame deployed at $BUNE_ADDR"

  Pop-Location

  if (-not (Test-Path $webDir)) { New-Item -ItemType Directory -Path $webDir | Out-Null }
  $cfgPath = Join-Path $webDir "config.js"
  $chainId = 31337
  $cfg = @"
window.BUNE_CONFIG = {
  rpcUrl: "$Rpc",
  chainId: $chainId,
  usdc: "$USDC_ADDR",
  bune: "$BUNE_ADDR",
};
"@
  $cfg | Set-Content -Path $cfgPath -Encoding UTF8
  Write-Ok "Wrote $cfgPath"

  # Quick sanity checks
  Write-Step "Verifying contract reads"
  $entryAmt = & cast call $BUNE_ADDR "entryAmount()(uint256)" --rpc-url $Rpc
  $roundNow = & cast call $BUNE_ADDR "currentRound()(uint256)" --rpc-url $Rpc
  Write-Ok "entryAmount=$entryAmt round=$roundNow"

  Write-Host "\nDone. Next: serve the UI ->`n  npx serve web -l 3000`n  (or) python -m http.server 3000 -d web" -ForegroundColor Yellow
}
catch {
  Write-Err $_
  exit 1
}

