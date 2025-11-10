import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config({ path: __dirname + "/../.env" });

async function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

async function main() {
  const addr = process.env.ADDR || process.argv[2];
  if (!addr) throw new Error("Pass deployed GuessRounds address via ADDR env or argv[2]");
  const coordinator = process.env.VRF_COORDINATOR as string;
  const subId = BigInt(process.env.VRF_SUBSCRIPTION_ID || "0");
  const keyHash = process.env.VRF_KEY_HASH as string;
  const callbackGasLimit = Number(process.env.VRF_CALLBACK_GAS_LIMIT || "250000");
  const requestConfirmations = Number(process.env.VRF_REQUEST_CONFIRMATIONS || "3");
  if (!coordinator) throw new Error("Missing VRF_COORDINATOR");

  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);
  console.log("Coordinator:", coordinator);
  console.log("Subscription:", String(subId));
  console.log("Consumer to add:", addr);

  // Use v2.5 interface to support uint256 subId
  const coord = await ethers.getContractAt("contracts/vendor/VRFCoordinatorV2_5Interface.sol:VRFCoordinatorV2_5Interface", coordinator);
  if (subId === 0n) {
    console.log("nativePayment mode: skipping addConsumer");
  } else {
    try {
      const tx = await coord.addConsumer(subId, addr);
      await tx.wait();
      console.log("Added consumer");
    } catch (e: any) {
      console.log("addConsumer error:", e?.message || e);
    }
  }

  const game = await ethers.getContractAt("GuessRounds", addr);
  // Ensure on-chain params match env (esp. subId)
  try {
    const tx0 = await game.setVrfParams(keyHash, subId, callbackGasLimit, requestConfirmations);
    await tx0.wait();
    console.log("Updated on-chain VRF params");
  } catch (e: any) {
    console.log("setVrfParams error:", e?.message || e);
  }
  try {
    const tx2 = await game.requestNextRoundRandomness();
    await tx2.wait();
    console.log("Requested VRF for next round");
  } catch (e: any) {
    console.log("requestNextRoundRandomness error:", e?.message || e);
  }

  // Poll for activation up to ~3 minutes, then print round info
  const start = Date.now();
  let active = false;
  let rid = 0n;
  while (Date.now() - start < 180_000) {
    try {
      active = await game.isActive();
      rid = await game.currentRoundId();
      console.log(`Round #${rid.toString()} active:`, active);
      if (active) break;
    } catch (e) {
      console.log('poll error:', (e as any)?.message || e);
    }
    await sleep(5000);
  }
  if (active) {
    const r = await game.currentRound();
    console.log('currentRoundId', rid.toString());
    console.log('endTime', Number(r.endTime).toString());
  } else {
    console.log('Round not active yet.');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
