import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config({ path: __dirname + "/.env" });

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  networks: {
    hardhat: {},
    baseSepolia: {
      url: process.env.RPC_BASE_SEPOLIA || "https://sepolia.base.org",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : undefined
    },
    base: {
      url: process.env.RPC_BASE_MAINNET || "https://mainnet.base.org",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : undefined
    }
  }
};

export default config;

