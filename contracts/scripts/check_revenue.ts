import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const treasuryAddress = deployer.address;
  const currency = (await ethers.provider.getNetwork()).chainId === 10143n ? "MON" : "ETH";

  // The treasury starts with 10,000 local test tokens from Hardhat.
  // We can track its balance, or just explain the logic.
  console.log("=========================================");
  console.log("💰 PARALLAX STARTUP REVENUE DASHBOARD 💰");
  console.log("=========================================");
  console.log(`Treasury Wallet: ${treasuryAddress}`);
  
  const balance = await ethers.provider.getBalance(treasuryAddress);
  console.log(`Current Balance: ${ethers.formatEther(balance)} ${currency}`);
  console.log("");
  console.log("Revenue Streams Active in ParallaxEscrow.sol:");
  console.log("1. Platform Fee: 5% of every successfully completed microtask.");
  console.log("2. Slashing: 100% of staked native tokens from bad workers goes to Treasury.");
  console.log("3. Forfeiture: 50% of staked native tokens from workers who abandon tasks goes to Treasury.");
  console.log("=========================================");
}

main().catch(console.error);
