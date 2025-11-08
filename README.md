# GuessRounds on Base (Sepolia/Mainnet)

This repo contains a round-based number guessing dApp designed for Base, using Chainlink VRF for pre-round randomness, a Hardhat project with tests, and a minimal React (Vite + wagmi + viem) front-end with a Farcaster miniapp wrapper.

## Contents
- `hardhat/` — Hardhat workspace
  - `contracts/GuessRounds.sol` — Solidity contract (0.8.24) with Chainlink VRF
  - `deploy/00_deploy.ts` — Parametric deploy script
  - `test/guessRounds.test.ts` — Unit tests (VRF mock)
  - `.env.example` — Env variables
- `frontend/` — Vite + React + wagmi UI
  - `public/miniapp.json` — Farcaster miniapp manifest (placeholder)
  - Reuses the same components for a minimal miniapp route (`/miniapp`)

## Prerequisites
- Node.js 20+ recommended (Chainlink and Hardhat toolchain works best)
- Foundry (optional for local debugging)

## Smart Contract

Features:
- Rounds last `roundDuration` seconds (default 2 hours)
- Single prize pool per round; `entryFeeWei` (default 0.00001 ETH) per guess
- Target number [1..1000] is set by Chainlink VRF before each round starts
- Users can submit many guesses; stored with timestamps
- On round end: owner calls `endAndSettle()` to close, determine winner (closest; tie -> earliest timestamp; exact-match ties -> earliest), payout 90% to winner and 10% to owner; if only 1 participant, refund 100%
- After settlement, requests randomness for the next round and starts it automatically upon fulfillment
- Views: current round details, `isActive`, all guesses for a round, total prize (pot), prior winners
- Admin: update entry fee, update round duration, end+settle, pause/resume
- Events: `GuessSubmitted`, `RoundStarted`, `RoundEnded`, `Payout`

### Configure VRF and Deploy
1) Create/fund a Chainlink VRF subscription for your target network
   - Base Sepolia or Base mainnet; note `subscriptionId`
   - Add your deployed contract address as a consumer after deployment
2) Collect network-specific values from Chainlink docs:
   - VRF Coordinator address (Base Sepolia / Base)
   - Key hash (gasLane)
   - Recommended `callbackGasLimit` and `requestConfirmations`

Populate `hardhat/.env` (copy from `.env.example`):

```
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
RPC_BASE_SEPOLIA=https://sepolia.base.org
RPC_BASE_MAINNET=https://mainnet.base.org
VRF_COORDINATOR=0xCoordinator
VRF_KEY_HASH=0xKeyHash
VRF_SUBSCRIPTION_ID=1234
VRF_CALLBACK_GAS_LIMIT=250000
VRF_REQUEST_CONFIRMATIONS=3
ENTRY_FEE_WEI=10000000000000
ROUND_DURATION_SECONDS=7200
```

Install and compile:

```
cd hardhat
npm install
npm run build
```

Deploy to Base Sepolia:

```
npm run deploy:sepolia
```

The script deploys `GuessRounds` and calls `requestNextRoundRandomness()` to bootstrap the first round. After VRF fulfillment, the first round starts automatically.

Add the deployed contract as a consumer to your VRF subscription (via Chainlink UI or script). If you add it after deployment, you can safely call `requestNextRoundRandomness()` again.

To deploy to Base mainnet:

```
npm run deploy:base
```

## Tests

Run unit tests with a VRF mock:

```
cd hardhat
npm test
```

Tests cover:
- Winner selection
- Tie rules (earliest timestamp)
- Single participant refund (no owner cut)
- 90/10 fee split
- Pause/resume
- Admin updates

## Front-end (Vite + wagmi + viem)

Setup:

```
cd frontend
cp .env.example .env.local
# set VITE_RPC_URL and VITE_CONTRACT_ADDRESS; optionally VITE_CHAIN_ID (84532 for Base Sepolia)
npm install
npm run dev
```

Features:
- Wallet connect (wagmi connectors)
- Countdown timer to round end
- Live activity feed (polls `getGuesses`) and refresh button
- Submit guess form (multiple submissions supported)
- Round history placeholder (extend as needed)

## Farcaster Miniapp Wrapper

- Manifest: `frontend/public/miniapp.json` (placeholder). See https://miniapps.farcaster.xyz/docs/getting-started
- Minimal wrapper route: `/miniapp` renders the same components with a simplified layout; hook up intents/buttons per platform requirements.

## Production Notes
- Replace any placeholder Chainlink VRF parameters with the exact values for Base networks.
- Enforce rate limits and add robust error handling in the UI.
- Consider subgraph/indexer for scalable history and activity feeds.

