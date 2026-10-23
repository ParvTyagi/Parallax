import { ethers } from "hardhat";
import hre from "hardhat";
import fs from "fs";
import path from "path";
const { configureDeployment } = require("./configure-deployment.cjs");

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("DEPLOYER_PRIVATE_KEY is required");
  const network = await ethers.provider.getNetwork();
  if (![10143n, 31337n, 11155111n].includes(network.chainId)) {
    throw new Error("Deployment is restricted to Monad testnet, Sepolia or localhost");
  }
  const deployerAddress = await deployer.getAddress();
  const orchestratorAddress = process.env.ORCHESTRATOR_ADDRESS || deployerAddress;
  const platformTreasury = process.env.PLATFORM_TREASURY || process.env.TREASURY_ADDRESS || deployerAddress;
  const adminAddress = process.env.ADMIN_ADDRESS || orchestratorAddress;
  for (const address of [orchestratorAddress, platformTreasury, adminAddress]) {
    if (!ethers.isAddress(address) || address === ethers.ZeroAddress) throw new Error("Invalid deployment role address");
  }
  console.log(`Deploying to ${hre.network.name} (${network.chainId}) from ${deployerAddress}`);
  const factory = await ethers.getContractFactory("ParallaxTaskManager");
  const taskManager = await factory.deploy(orchestratorAddress, platformTreasury, adminAddress);
  const tx = taskManager.deploymentTransaction()!;
  const record = {
    network: hre.network.name, chainId: Number(network.chainId), state: "submitted",
    taskManagerAddress: await taskManager.getAddress(), deploymentTxHash: tx.hash,
    deployerAddress, orchestratorAddress, platformTreasury, adminAddress,
  };
  const recordPath = path.join(__dirname, `../deployments/${hre.network.name}-${tx.hash}.json`);
  fs.mkdirSync(path.dirname(recordPath), { recursive: true });
  fs.writeFileSync(recordPath, JSON.stringify(record, null, 2) + "\n");
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error("Deployment failed; inspect the saved transaction before retrying");
  const artifact = await hre.artifacts.readArtifact("ParallaxTaskManager");
  if (ethers.keccak256(await ethers.provider.getCode(record.taskManagerAddress)) !== ethers.keccak256(artifact.deployedBytecode)) {
    throw new Error("Deployed bytecode differs from the compiled contract");
  }
  const escrowAddress = await taskManager.escrow();
  if (await taskManager.DISPUTE_WINDOW() !== 0n) throw new Error("Deployment must pay immediately");
  const verified = { ...record, state: "verified", escrowAddress, startBlock: receipt.blockNumber, deployedAt: new Date().toISOString() };
  fs.writeFileSync(recordPath, JSON.stringify(verified, null, 2) + "\n");
  configureDeployment(verified);
  console.log(JSON.stringify(verified, null, 2));
}

main().catch((error) => {
  console.error(error.shortMessage || error.message);
  process.exitCode = 1;
});
