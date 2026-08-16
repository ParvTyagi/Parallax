import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const rpcUrl = "https://testnet-rpc.monad.xyz";
const taskManagerAddress = "0x8a50d0208c719cBB92094f3A18A072Ce37cad974";
const privateKey = "1c2c211fa266a0ebdd25e2e55a002ae2db31c5fad315d3bc28449670eb5934a8";

const TASK_MANAGER_ABI = [
  "function verifySubtask(bytes32 taskId, bytes32 subtaskId, bool passed, uint8 score) external"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(taskManagerAddress, TASK_MANAGER_ABI, wallet);

  const taskId = "0x19e5398f5faa78f42e1c45e484b9132fe291bbbb279a525ab23c5b60897b9c5a";
  const subtaskId = "0x6897ea15e2da79e8f15671ff82667f2f148064dbe067e04137b327e6b92b55c4"; // BFS

  console.log(`Calling verifySubtask for subtaskId: ${subtaskId}`);

  try {
    const tx = await contract.verifySubtask(taskId, subtaskId, false, 0, { gasLimit: 3000000 });
    console.log(`Tx sent: ${tx.hash}`);
    await tx.wait();
    console.log("Tx mined!");
  } catch (e: any) {
    console.error("Tx failed:", e.message);
  }
}

main();
