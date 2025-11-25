import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config({ path: __dirname + "/../.env" });

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const entryFee = BigInt(process.env.ENTRY_FEE_WEI || "10000000000000");
  const roundDuration = Number(process.env.ROUND_DURATION_SECONDS || "172800"); // default 2 days

  const GuessRounds = await ethers.getContractFactory("GuessRounds");
  const contract = await GuessRounds.deploy(entryFee, roundDuration);
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log("GuessRounds deployed:", addr);

  // Bootstrap first round immediately with pseudo-random target
  const tx = await contract.startNextRound();
  await tx.wait();
  console.log("Started first round");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
