import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config({ path: __dirname + "/../.env" });

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const coordinator = process.env.VRF_COORDINATOR as string;
  const keyHash = process.env.VRF_KEY_HASH as string;
  const subId = BigInt(process.env.VRF_SUBSCRIPTION_ID || "0");
  const callbackGasLimit = Number(process.env.VRF_CALLBACK_GAS_LIMIT || "250000");
  const requestConfirmations = Number(process.env.VRF_REQUEST_CONFIRMATIONS || "3");
  const entryFee = BigInt(process.env.ENTRY_FEE_WEI || "10000000000000");
  const roundDuration = Number(process.env.ROUND_DURATION_SECONDS || "7200");

  if (!coordinator || !keyHash || subId === 0n) {
    throw new Error("Missing VRF config: VRF_COORDINATOR, VRF_KEY_HASH, VRF_SUBSCRIPTION_ID");
  }

  const GuessRounds = await ethers.getContractFactory("GuessRounds");
  const contract = await GuessRounds.deploy(
    coordinator,
    keyHash,
    subId,
    callbackGasLimit,
    requestConfirmations,
    entryFee,
    roundDuration
  );
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log("GuessRounds deployed:", addr);

  // Bootstrap first round RNG
  const tx = await contract.requestNextRoundRandomness();
  await tx.wait();
  console.log("Requested VRF for next round. Wait for fulfillment to auto-start round 1.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

