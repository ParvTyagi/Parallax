import { ethers } from "hardhat";
import hre from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer ? await deployer.getAddress() : "UNKNOWN");

  // Hardcoded orchestrator and treasury for hackathon demo
  const orchestratorAddress = deployer ? await deployer.getAddress() : "0x0000000000000000000000000000000000000000";
  const platformTreasury = "0xf302D2f179baf42d6F02E337B25Cf882499b39e6";

  const TaskManager = await ethers.getContractFactory("ParallaxTaskManager");
  const taskManager = await TaskManager.deploy(orchestratorAddress, platformTreasury);
  await taskManager.waitForDeployment();
  const taskManagerAddress = await taskManager.getAddress();
  console.log("ParallaxTaskManager deployed to:", taskManagerAddress);

  // Read escrow address automatically deployed by TaskManager
  const escrowAddress = await taskManager.escrow();
  console.log("ParallaxEscrow deployed automatically to:", escrowAddress);

  // Export to frontend
  const fs = require("fs");
  const path = require("path");
  
  const frontendConstantsPath = path.join(__dirname, "../../frontend/src/lib/constants.ts");
  
  // Get ABI from artifacts
  const artifact = await hre.artifacts.readArtifact("ParallaxTaskManager");
  
  const constantsContent = `export const API_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1"
    ? "https://parallax-8yob.onrender.com"
    : "http://localhost:3000");

export const TASK_MANAGER_ADDRESS =
  import.meta.env.VITE_TASKMANAGER_ADDRESS || "${taskManagerAddress}";

export const TASK_MANAGER_ABI = ${JSON.stringify(artifact.abi, null, 2)};
`;

  fs.writeFileSync(frontendConstantsPath, constantsContent);
  console.log("Updated frontend constants.ts");
  
  // Export to backend
  const backendEnvPath = path.join(__dirname, "../../backend/.env");
  if (fs.existsSync(backendEnvPath)) {
    let envContent = fs.readFileSync(backendEnvPath, "utf-8");
    envContent = envContent.replace(/TASK_MANAGER_ADDRESS=.*/g, `TASK_MANAGER_ADDRESS=${taskManagerAddress}`);
    fs.writeFileSync(backendEnvPath, envContent);
    console.log("Updated backend .env");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
