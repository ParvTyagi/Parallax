import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    monadTestnet: {
      url: process.env.MONAD_RPC_URL || "",
      chainId: process.env.MONAD_CHAIN_ID ? parseInt(process.env.MONAD_CHAIN_ID) : 10143,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : []
    }
  }
};

export default config;
