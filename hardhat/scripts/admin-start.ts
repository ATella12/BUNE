import { ethers } from "hardhat";

/**
 * Admin helper to manually start the next round (VRF fallback).
 * Usage:
 *  ADDR=0xYourGuessRounds npx hardhat run --network baseSepolia scripts/admin-start.ts
 * Optional: TARGET=777 to set the target number (1..1000; default 777)
 */
async function main() {
  const addr = process.env.ADDR || process.argv[2];
  if (!addr) throw new Error("Pass contract address via ADDR env or argv[2]");
  const targetEnv = process.env.TARGET || process.argv[3] || "777";
  const target = Number(targetEnv);
  if (!Number.isInteger(target) || target < 1 || target > 1000) {
    throw new Error("TARGET must be an integer in [1..1000]");
  }

  const [signer] = await ethers.getSigners();
  console.log("Owner:", signer.address);
  console.log("Contract:", addr);
  console.log("Manual target:", target);

  const game = await ethers.getContractAt("GuessRounds", addr, signer);
  const tx = await game.adminStartNextRoundManual(target);
  await tx.wait();
  console.log("Started manual round");

  const rid = await game.currentRoundId();
  const r = await game.currentRound();
  console.log("currentRoundId", rid.toString());
  console.log("endTime", Number(r.endTime));
}

main().catch((e) => { console.error(e); process.exit(1); });

