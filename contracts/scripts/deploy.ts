import { ethers } from "hardhat";
import hre from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const deployerAddress = deployer ? await deployer.getAddress() : "UNKNOWN";

  console.log("----------------------------------------------------");
  console.log(`Deploying to network: ${hre.network.name} (Chain ID: ${network.chainId})`);
  console.log("Deployer account:   ", deployerAddress);
  console.log("----------------------------------------------------");

  // Orchestrator, Treasury, and Admin addresses
  const orchestratorAddress = process.env.ORCHESTRATOR_ADDRESS || deployerAddress;
  const platformTreasury = process.env.PLATFORM_TREASURY || process.env.TREASURY_ADDRESS || deployerAddress;
  const adminAddress = process.env.ADMIN_ADDRESS || orchestratorAddress;

  console.log("Orchestrator:       ", orchestratorAddress);
  console.log("Platform Treasury:  ", platformTreasury);
  console.log("Admin:              ", adminAddress);

  const TaskManager = await ethers.getContractFactory("ParallaxTaskManager");
  const taskManager = await TaskManager.deploy(orchestratorAddress, platformTreasury, adminAddress);
  await taskManager.waitForDeployment();
  const taskManagerAddress = await taskManager.getAddress();
  console.log("ParallaxTaskManager deployed to:", taskManagerAddress);

  // Read escrow address automatically deployed by TaskManager
  let escrowAddress = "";
  for (let i = 0; i < 6; i++) {
    try {
      escrowAddress = await taskManager.escrow();
      if (escrowAddress && escrowAddress !== ethers.ZeroAddress) break;
    } catch (e) {
      console.log(`Waiting for RPC sync (attempt ${i + 1}/6)...`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  console.log("ParallaxEscrow deployed automatically to:", escrowAddress);

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    chainId: Number(network.chainId),
    taskManagerAddress,
    escrowAddress,
    orchestratorAddress,
    platformTreasury,
    adminAddress,
    deployedAt: new Date().toISOString()
  };

  const deploymentPath = path.join(__dirname, "../deployment.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("Saved deployment info to contracts/deployment.json");

  // Export to frontend constants
  const frontendConstantsPath = path.join(__dirname, "../../frontend/src/lib/constants.ts");
  const artifact = await hre.artifacts.readArtifact("ParallaxTaskManager");

  const constantsContent = `export const API_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1"
    ? "https://parallax-8yob.onrender.com"
    : "http://localhost:3000");

export const TASK_MANAGER_ADDRESS =
  import.meta.env.VITE_TASKMANAGER_ADDRESS || "${taskManagerAddress}";

export const ESCROW_ADDRESS =
  import.meta.env.VITE_ESCROW_ADDRESS || "${escrowAddress}";

export const BLOCK_EXPLORER_URL =
  import.meta.env.VITE_BLOCK_EXPLORER_URL || "https://sepolia.etherscan.io";

export const ETH_CHAIN_ID =
  import.meta.env.VITE_ETH_CHAIN_ID || import.meta.env.VITE_MONAD_CHAIN_ID || "0xaa36a7";

export const TASK_MANAGER_ABI = ${JSON.stringify(artifact.abi, null, 2)};
`;

  fs.writeFileSync(frontendConstantsPath, constantsContent);
  console.log("Updated frontend/src/lib/constants.ts");

  // Export to backend .env
  const backendEnvPath = path.join(__dirname, "../../backend/.env");
  const rootEnvExamplePath = path.join(__dirname, "../../.env.example");

  let envContent = "";
  if (fs.existsSync(backendEnvPath)) {
    envContent = fs.readFileSync(backendEnvPath, "utf-8");
  } else if (fs.existsSync(rootEnvExamplePath)) {
    envContent = fs.readFileSync(rootEnvExamplePath, "utf-8");
  }

  if (envContent) {
    if (envContent.includes("TASKMANAGER_ADDRESS=")) {
      envContent = envContent.replace(/TASKMANAGER_ADDRESS=.*/g, `TASKMANAGER_ADDRESS=${taskManagerAddress}`);
    } else {
      envContent += `\nTASKMANAGER_ADDRESS=${taskManagerAddress}`;
    }

    if (envContent.includes("ESCROW_ADDRESS=")) {
      envContent = envContent.replace(/ESCROW_ADDRESS=.*/g, `ESCROW_ADDRESS=${escrowAddress}`);
    } else {
      envContent += `\nESCROW_ADDRESS=${escrowAddress}`;
    }

    fs.writeFileSync(backendEnvPath, envContent);
    console.log("Updated backend/.env with contract addresses");
  }

  console.log("----------------------------------------------------");
  console.log("Deployment completed successfully!");
  console.log("----------------------------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
