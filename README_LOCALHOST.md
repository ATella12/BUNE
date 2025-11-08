## Number Guessing dApp (Base) + Farcaster Miniapp scaffold

This repo now includes a scaffold for a round-based number guessing game built for Base, with a minimal Farcaster Miniapp front-end.

### Contracts (Foundry)

- File: `contracts/src/GuessingGame.sol`
- Summary:
  - Rounds default to 2 hours. Admin can change via `setRoundDuration`.
  - Entry fee default: `0.00001 ETH` (admin can update with `setEntryFeeWei`).
  - Before each round, a target number in `[1..1000]` is derived from a commit (replace with VRF in production). The round is marked active.
  - Users can submit guesses (`submitGuess(uint32) payable`) multiple times while active; each guess costs the entry fee and is recorded.
  - When a round ends, only owner calls `endAndSettle()` which closes the round, determines winner (closest; earliest timestamp tie-breaker; exact-match ties resolved by earliest), pays 90% to winner and 10% to owner, handles 1-participant refund, and then automatically starts the next round with a fresh randomness commit.
  - Public views: `currentRound()`, `isActive()`, `getGuesses(roundId)`, `priorWinnersCount()`, `getWinnerAt(index)`, plus `rounds(roundId)` mapping and `currentRoundId()`.
  - Admin controls: `setEntryFeeWei`, `setRoundDuration`, `endAndSettle`, `setPaused`, and `startNextRound`.
  - Events: `GuessSubmitted`, `RoundStarted`, `RoundEnded`, `Payout`, and param update events.

> NOTE: Randomness is scaffolded with a commit derived from block values. Replace with Chainlink VRF (or a Base-supported randomness source) for production.

#### Quick Foundry commands

```
cd contracts
forge build
forge create --rpc-url $RPC_URL --private-key $PK src/GuessingGame.sol:GuessingGame
```

After deploying, call `startNextRound()` as the owner to begin the first round.

### Farcaster Miniapp (Next.js)

Folder: `miniapp/`

- Minimal Next.js app that reads on-chain state via `viem` and displays the current round, pot, and entry fee.
- For submitting guesses inside Farcaster, wire your wallet flow (e.g., Base OnchainKit, WalletConnect, or a client-supported miniapp wallet) to call `submitGuess(uint32)` with the entry fee as `msg.value`.

#### Setup

```
cd miniapp
cp .env.example .env.local
# set NEXT_PUBLIC_RPC_URL (Base or Base Sepolia) and NEXT_PUBLIC_CONTRACT_ADDRESS
npm install
npm run dev
```

Open http://localhost:3000

#### Production notes

- Add a proper miniapp manifest per https://miniapps.farcaster.xyz/docs/getting-started and any required endpoints.
- Replace scaffolded randomness in the contract with a VRF integration as per Base docs: https://docs.base.org/get-started/build-app
