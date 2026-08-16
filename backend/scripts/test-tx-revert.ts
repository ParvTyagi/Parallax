import { ethers } from "ethers";

const rpcUrl = "https://testnet-rpc.monad.xyz";
const contractAddress = "0xa77Ab6E4C66A07cDE61679D04998BcE9C80507BB";

const ABI = [
  "function verifySubtask(bytes32 taskId, bytes32 subtaskId, bool passed, uint8 score) external",
  "function subtasks(bytes32) external view returns (bytes32 taskId, string rangeLabel, uint256 reward, uint256 leaseDuration, address worker, uint8 state, uint256 claimTime, bytes32 submissionHash, uint8 score)"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(contractAddress, ABI, provider);

  // The subtaskId the user posted in the latest log
  const subtaskId = "0xc3ee302a7f65d0243dce41563103553f505a9570d66539d4ffacdfa9e8d7db2c";
  
  try {
    const st = await contract.subtasks(subtaskId);
    console.log("Subtask data:", st);
    const states = ["CREATED", "CLAIMED", "SUBMITTED", "VERIFIED", "REJECTED"];
    console.log("State:", states[st.state] || st.state);
  } catch (e) {
    console.log("Error reading subtask:", e);
  }
}
main();
