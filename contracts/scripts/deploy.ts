import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer ? await deployer.getAddress() : "UNKNOWN");

  const Escrow = await ethers.getContractFactory("ParallaxEscrow");
  const escrow = await Escrow.deploy();
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("ParallaxEscrow deployed to:", escrowAddress);

  // Hardcoded orchestrator for hackathon demo (will be read from backend env later, but deployer can also be orchestrator or another fixed address)
  const orchestratorAddress = deployer ? await deployer.getAddress() : "0x0000000000000000000000000000000000000000";

  const TaskManager = await ethers.getContractFactory("ParallaxTaskManager");
  const taskManager = await TaskManager.deploy(escrowAddress, orchestratorAddress);
  await taskManager.waitForDeployment();
  const taskManagerAddress = await taskManager.getAddress();
  console.log("ParallaxTaskManager deployed to:", taskManagerAddress);

  // Set TaskManager in Escrow
  await escrow.setTaskManager(taskManagerAddress);
  console.log("TaskManager registered in Escrow.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
