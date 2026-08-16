import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const rpcUrl = "https://testnet-rpc.monad.xyz";
const taskManagerAddress = "0x8a50d0208c719cBB92094f3A18A072Ce37cad974";

const TASK_MANAGER_ABI = [
  "function subtasks(bytes32) external view returns (bytes32 taskId, string rangeLabel, uint256 reward, uint256 leaseDuration, address worker, uint8 state, uint256 claimTime, bytes32 submissionHash, uint8 score)",
  "function escrow() external view returns (address)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(taskManagerAddress, TASK_MANAGER_ABI, provider);

  const subtaskId = "0xd05d47c60d0ecf3693a4c9bb6d276aaa8a3bd08d5b47f6a31699587c05fbb34b"; // subtask 3 from earlier
  console.log(`Checking subtask state on blockchain: ${subtaskId}`);

  try {
    const subtask = await contract.subtasks(subtaskId);
    console.log("Subtask data on chain:", subtask);
    
    // SubtaskState enum: 0=CREATED, 1=CLAIMED, 2=SUBMITTED, 3=VERIFIED, 4=REJECTED
    const states = ["CREATED", "CLAIMED", "SUBMITTED", "VERIFIED", "REJECTED"];
    console.log(`State is: ${states[subtask.state]}`);
  } catch (e) {
    console.error("Error reading contract:", e);
  }
}

main();
