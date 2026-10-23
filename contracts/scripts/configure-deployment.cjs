const fs = require("node:fs");
const path = require("node:path");
const { ethers } = require("ethers");

const networks = {
  10143: { rpc: "https://testnet-rpc.monad.xyz", explorer: "https://testnet.monadexplorer.com" },
  31337: { rpc: "http://127.0.0.1:8545", explorer: "" },
  11155111: { rpc: "https://ethereum-sepolia-rpc.publicnode.com", explorer: "https://sepolia.etherscan.io" },
};

function updateEnv(filename, updates) {
  let content = fs.existsSync(filename) ? fs.readFileSync(filename, "utf8") : "";
  for (const [key, value] of Object.entries(updates)) {
    const pattern = new RegExp(`^${key}=.*$`, "gm");
    const line = `${key}=${value}`;
    content = pattern.test(content) ? content.replace(pattern, () => line) : `${content.trimEnd()}\n${line}\n`;
  }
  fs.writeFileSync(filename, content);
}

function configureDeployment(record, root = path.resolve(__dirname, "../..")) {
  const network = networks[record.chainId];
  if (!network || record.state !== "verified" || !Number.isInteger(record.startBlock) || record.startBlock < 0 ||
      !ethers.isAddress(record.taskManagerAddress) || !ethers.isAddress(record.escrowAddress)) {
    throw new Error("Only a verified deployment on a supported network can be activated");
  }
  const chainId = `0x${record.chainId.toString(16)}`;
  const constantsPath = path.join(root, "frontend/src/lib/constants.ts");
  let constants = fs.readFileSync(constantsPath, "utf8");
  constants = constants.replace(/import\.meta\.env\.VITE_TASKMANAGER_ADDRESS \|\| "[^"]*"/, `import.meta.env.VITE_TASKMANAGER_ADDRESS || "${record.taskManagerAddress}"`);
  constants = constants.replace(/import\.meta\.env\.VITE_ESCROW_ADDRESS \|\| "[^"]*"/, `import.meta.env.VITE_ESCROW_ADDRESS || "${record.escrowAddress}"`);
  constants = constants.replace(/import\.meta\.env\.VITE_BLOCK_EXPLORER_URL \|\| "[^"]*"/, `import.meta.env.VITE_BLOCK_EXPLORER_URL || "${network.explorer}"`);
  constants = constants.replace(/export const ETH_CHAIN_ID =[^;]+;/, `export const ETH_CHAIN_ID =\n  import.meta.env.VITE_MONAD_CHAIN_ID || import.meta.env.VITE_ETH_CHAIN_ID || "${chainId}";`);
  const artifact = JSON.parse(fs.readFileSync(path.join(root, "contracts/artifacts/contracts/ParallaxTaskManager.sol/ParallaxTaskManager.json"), "utf8"));
  constants = constants.slice(0, constants.indexOf("export const TASK_MANAGER_ABI")) + `export const TASK_MANAGER_ABI = ${JSON.stringify(artifact.abi, null, 2)};\n`;
  fs.writeFileSync(constantsPath, constants);
  updateEnv(path.join(root, "backend/.env"), {
    MONAD_RPC_URL: network.rpc, ETH_RPC_URL: network.rpc,
    TASKMANAGER_ADDRESS: record.taskManagerAddress, ESCROW_ADDRESS: record.escrowAddress,
    CHAIN_START_BLOCK: record.startBlock,
  });
  updateEnv(path.join(root, "frontend/.env"), {
    VITE_MONAD_CHAIN_ID: chainId, VITE_ETH_CHAIN_ID: chainId,
    VITE_BLOCK_EXPLORER_URL: network.explorer,
    VITE_TASKMANAGER_ADDRESS: record.taskManagerAddress, VITE_ESCROW_ADDRESS: record.escrowAddress,
  });
  fs.writeFileSync(path.join(root, "contracts/deployment.json"), JSON.stringify(record, null, 2) + "\n");
  console.log("Activated verified deployment in frontend constants, local environment files and deployment.json");
}

module.exports = { configureDeployment };
