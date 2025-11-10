import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config({ path: __dirname + "/../.env" });

async function main() {
  const coordAddr = process.env.VRF_COORDINATOR as string;
  const subId = BigInt(process.env.VRF_SUBSCRIPTION_ID || '0');
  if (!coordAddr || subId === 0n) throw new Error('Missing VRF_COORDINATOR or VRF_SUBSCRIPTION_ID');
  const [signer] = await ethers.getSigners();
  console.log('Signer:', signer.address);
  console.log('Coordinator:', coordAddr);
  console.log('Subscription:', String(subId));
  const coord = await ethers.getContractAt("@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol:VRFCoordinatorV2Interface", coordAddr);
  const sub = await coord.getSubscription(subId);
  console.log('balance:', sub[0].toString());
  console.log('owner:', sub[2]);
  console.log('consumers:', sub[3]);
}

main().catch((e) => { console.error(e); process.exit(1); });

