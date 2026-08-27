import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const treasuryAddress = deployer.address;

  // The treasury starts with 10,000 ETH/MON from Hardhat.
  // We can track its balance, or just explain the logic.
  console.log("=========================================");
  console.log("💰 PARALLAX STARTUP REVENUE DASHBOARD 💰");
  console.log("=========================================");
  console.log(`Treasury Wallet: ${treasuryAddress}`);
  
  const balance = await ethers.provider.getBalance(treasuryAddress);
  console.log(`Current Balance: ${ethers.formatEther(balance)} MON`);
  console.log("");
  console.log("Revenue Streams Active in ParallaxEscrow.sol:");
  console.log("1. Platform Fee: 5% of every successfully completed microtask.");
  console.log("2. Slashing: 100% of staked MON from bad workers goes to Treasury.");
  console.log("3. Forfeiture: 50% of staked MON from workers who abandon tasks goes to Treasury.");
  console.log("=========================================");
}

main().catch(console.error);
