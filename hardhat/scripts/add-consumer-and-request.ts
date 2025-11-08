import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config({ path: __dirname + "/../.env" });

async function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

async function main() {
  const addr = process.env.ADDR || process.argv[2];
  if (!addr) throw new Error("Pass deployed GuessRounds address via ADDR env or argv[2]");
  const coordinator = process.env.VRF_COORDINATOR as string;
  const subId = BigInt(process.env.VRF_SUBSCRIPTION_ID || "0");
  if (!coordinator || subId === 0n) throw new Error("Missing VRF_COORDINATOR or VRF_SUBSCRIPTION_ID");

  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);
  console.log("Coordinator:", coordinator);
  console.log("Subscription:", String(subId));
  console.log("Consumer to add:", addr);

  const coord = await ethers.getContractAt("@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol:VRFCoordinatorV2Interface", coordinator);
  // Add consumer (idempotent on provider side; may revert if already added)
  try {
    const tx = await coord.addConsumer(subId, addr);
    await tx.wait();
    console.log("Added consumer");
  } catch (e: any) {
    console.log("addConsumer error:", e?.message || e);
  }

  const game = await ethers.getContractAt("GuessRounds", addr);
  try {
    const tx2 = await game.requestNextRoundRandomness();
    await tx2.wait();
    console.log("Requested VRF for next round");
  } catch (e: any) {
    console.log("requestNextRoundRandomness error:", e?.message || e);
  }

  // Poll for activation up to ~3 minutes
  const start = Date.now();
  while (Date.now() - start < 180_000) {
    const isActive = await game.isActive();
    const rid = await game.currentRoundId();
    console.log(`Round #${rid.toString()} active:`, isActive);
    if (isActive) break;
    await sleep(5000);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

