// Resumable Monad testnet upgrade; activate only after bytecode and settings verification.
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const dotenv = require("dotenv");

const root = path.resolve(__dirname, "../..");
const backend = dotenv.parse(fs.readFileSync(path.join(root, "backend/.env")));
const deploymentEnv = dotenv.parse(fs.readFileSync(path.join(root, "contracts/.env")));
const artifact = JSON.parse(fs.readFileSync(path.join(root, "contracts/artifacts/contracts/ParallaxTaskManager.sol/ParallaxTaskManager.json")));
const recordPath = path.join(root, "contracts/deployments/immediate-payout-monad-testnet.json");

async function main() {
  const rpc = deploymentEnv.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";
  const provider = new ethers.JsonRpcProvider(rpc, undefined, { batchMaxCount: 1 });
  try {
    const network = await provider.getNetwork();
    if (network.chainId !== 10143n) throw new Error("Deployment is restricted to Monad testnet.");
    const key = deploymentEnv.DEPLOYER_PRIVATE_KEY;
    if (!key) throw new Error("DEPLOYER_PRIVATE_KEY is missing");
    const signer = new ethers.Wallet(key.startsWith("0x") ? key : "0x" + key, provider);
    let record = fs.existsSync(recordPath) ? JSON.parse(fs.readFileSync(recordPath)) : null;
    const oldAddress = record?.previousTaskManagerAddress || "0x7371e2777cD7Cbf9d3bE33F780122C1C9C9A4F20";
    const old = new ethers.Contract(oldAddress, artifact.abi, provider);
    const [orchestratorAddress, platformTreasury, adminAddress, bondAmount, oldEscrow] = await Promise.all([
      old.orchestrator(), old.platformTreasury(), old.admin(), old.workerBondAmount(), old.escrow()
    ]);
    const escrowAbi = ["function platformFeePercentage() view returns(uint256)", "function updateFee(uint256)", "function taskManager() view returns(address)"];
    const oldFee = await new ethers.Contract(oldEscrow, escrowAbi, provider).platformFeePercentage();
    const orchestratorKey = backend.ORCHESTRATOR_PRIVATE_KEY;
    const configuredSigner = new ethers.Wallet(orchestratorKey.startsWith("0x") ? orchestratorKey : "0x" + orchestratorKey);
    if (configuredSigner.address.toLowerCase() !== orchestratorAddress.toLowerCase()) throw new Error("Backend signer does not match the existing orchestrator.");
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
    fs.mkdirSync(path.dirname(recordPath), { recursive: true });
    if (!record) {
      const [latest, pending] = await Promise.all([signer.getNonce("latest"), signer.getNonce("pending")]);
      if (latest !== pending) throw new Error("Deployer has a pending transaction; wait before deployment.");
      const request = await factory.getDeployTransaction(orchestratorAddress, platformTreasury, adminAddress);
      const estimatedGas = await signer.estimateGas(request);
      const populated = await signer.populateTransaction({ ...request, nonce: pending, gasLimit: estimatedGas * 120n / 100n });
      const maxCost = populated.gasLimit * (populated.maxFeePerGas || populated.gasPrice);
      if (await provider.getBalance(signer.address) < maxCost) throw new Error("Insufficient testnet MON for deployment.");
      const signed = await signer.signTransaction(populated);
      record = {
        network: "monadTestnet", chainId: 10143, state: "submitted",
        taskManagerAddress: ethers.getCreateAddress({ from: signer.address, nonce: pending }),
        deploymentTxHash: ethers.keccak256(signed), deployerAddress: signer.address,
        previousTaskManagerAddress: oldAddress, previousEscrowAddress: oldEscrow,
        orchestratorAddress, platformTreasury, adminAddress,
        workerBondAmount: bondAmount.toString(), platformFeePercentage: oldFee.toString(),
        maxDeploymentCostMON: ethers.formatEther(maxCost)
      };
      fs.writeFileSync(recordPath, JSON.stringify(record, null, 2));
      console.log(JSON.stringify({ action: "broadcast", address: record.taskManagerAddress, txHash: record.deploymentTxHash, maxCostMON: record.maxDeploymentCostMON }));
      await provider.broadcastTransaction(signed);
    }
    const receipt = await provider.waitForTransaction(record.deploymentTxHash, 1, 120000);
    if (!receipt || receipt.status !== 1) throw new Error("Deployment not confirmed successfully; inspect the recorded transaction before retrying.");
    if (receipt.contractAddress?.toLowerCase() !== record.taskManagerAddress.toLowerCase()) throw new Error("Unexpected deployment address.");
    const deployed = new ethers.Contract(record.taskManagerAddress, artifact.abi, signer);
    const bytecode = await provider.getCode(record.taskManagerAddress);
    if (ethers.keccak256(bytecode) !== ethers.keccak256(artifact.deployedBytecode)) throw new Error("Deployed bytecode does not match the tested artifact.");
    if (await deployed.workerBondAmount() !== bondAmount) {
      if (signer.address.toLowerCase() !== adminAddress.toLowerCase()) throw new Error("Admin must set the preserved worker bond.");
      await (await deployed.setWorkerBondAmount(bondAmount)).wait();
    }
    const escrowAddress = await deployed.escrow();
    const escrow = new ethers.Contract(escrowAddress, escrowAbi, signer);
    if (await escrow.platformFeePercentage() !== oldFee) {
      if (signer.address.toLowerCase() !== platformTreasury.toLowerCase()) throw new Error("Treasury must set the preserved platform fee.");
      await (await escrow.updateFee(oldFee)).wait();
    }
    const [window, threshold, actualAdmin, actualOrchestrator, actualTreasury, manager] = await Promise.all([
      deployed.DISPUTE_WINDOW(), deployed.VERIFICATION_THRESHOLD(), deployed.admin(),
      deployed.orchestrator(), deployed.platformTreasury(), escrow.taskManager()
    ]);
    if (window !== 0n || threshold !== 70n || actualAdmin !== adminAddress || actualOrchestrator !== orchestratorAddress ||
      actualTreasury !== platformTreasury || manager.toLowerCase() !== record.taskManagerAddress.toLowerCase()) {
      throw new Error("Deployment settings failed verification.");
    }
    Object.assign(record, {
      state: "verified", escrowAddress, startBlock: receipt.blockNumber,
      deployedAt: new Date().toISOString(),
      deploymentGasUsed: receipt.gasUsed.toString(),
      deploymentCostMON: ethers.formatEther(receipt.gasUsed * receipt.gasPrice)
    });
    fs.writeFileSync(recordPath, JSON.stringify(record, null, 2));
    require("./configure-deployment.cjs").configureDeployment(record);
    console.log(JSON.stringify(record, null, 2));
  } finally {
    provider.destroy();
  }
}
main().catch(error => { console.error(error.shortMessage || error.message); process.exitCode = 1; });
