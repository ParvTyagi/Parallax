import type { HardhatUserConfig } from "hardhat/config";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatMocha from "@nomicfoundation/hardhat-mocha";
import hardhatEthersChaiMatchers from "@nomicfoundation/hardhat-ethers-chai-matchers";
import * as dotenv from "dotenv";

dotenv.config();

const accounts = process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  plugins: [hardhatEthers, hardhatMocha, hardhatEthersChaiMatchers],
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "paris",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: { type: "edr-simulated", chainType: "l1" },
    localhost: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: process.env.SEPOLIA_RPC_URL || process.env.ETH_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
      chainId: 11155111,
      accounts,
    },
    mainnet: {
      type: "http",
      chainType: "l1",
      url: process.env.MAINNET_RPC_URL || process.env.ETH_RPC_URL || "https://eth.llamarpc.com",
      chainId: 1,
      accounts,
    },
    monadTestnet: {
      type: "http",
      chainType: "l1",
      url: process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz",
      chainId: 10143,
      accounts,
    },
  },
};

export default config;
