import { ethers } from "ethers";
import { prisma } from "../db/client";
import dotenv from "dotenv";

dotenv.config();

const TASK_MANAGER_ABI = [
  "event TaskCreated(bytes32 indexed taskId, address indexed creator, uint256 budget)",
  "event SubtaskCreated(bytes32 indexed taskId, bytes32 indexed subtaskId, string rangeLabel, string description, uint256 reward)",
  "event SubtaskClaimed(bytes32 indexed taskId, bytes32 indexed subtaskId, address indexed worker)",
  "event SubmissionProofRecorded(bytes32 indexed taskId, bytes32 indexed subtaskId, bytes32 submissionHash)",
  "event SubtaskVerified(bytes32 indexed taskId, bytes32 indexed subtaskId, bool passed, uint8 score)"
];

export async function setupChainListeners() {
  const rpcUrl = process.env.MONAD_RPC_URL;
  const taskManagerAddress = process.env.TASKMANAGER_ADDRESS;

  if (!rpcUrl || !taskManagerAddress) {
    console.warn("Chain listeners skipped: MONAD_RPC_URL or TASKMANAGER_ADDRESS missing.");
    return;
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
  const contract = new ethers.Contract(taskManagerAddress, TASK_MANAGER_ABI, provider);

  console.log("Starting manual chain polling to avoid RPC rate limits...");

  let lastCheckedBlock = -1;

  setInterval(async () => {
    try {
      const currentBlock = await provider.getBlockNumber();
      if (lastCheckedBlock === -1) {
        lastCheckedBlock = currentBlock - 50; // On first run, check last 50 blocks
      }
      
      if (currentBlock <= lastCheckedBlock) return;

      // Query all events for the contract in the block range
      const events = await contract.queryFilter("*", lastCheckedBlock + 1, currentBlock);
      
      for (const event of events) {
        if (!('eventName' in event)) continue;
        
        try {
          if (event.eventName === "TaskCreated") {
            const [taskId, creator, budget] = event.args;
            console.log(`Event TaskCreated: ${taskId}`);
            await prisma.task.upsert({
              where: { taskId: taskId },
              update: { status: "ACTIVE" },
              create: {
                taskId: taskId,
                creator: creator,
                description: "Task from chain event",
                budget: ethers.formatEther(budget),
                status: "ACTIVE"
              }
            });
          }
          else if (event.eventName === "SubtaskCreated") {
            const [taskId, subtaskId, rangeLabel, description, reward] = event.args;
            console.log(`Event SubtaskCreated: ${subtaskId}`);
            await prisma.subtask.upsert({
              where: { subtaskId: subtaskId },
              update: { state: "CREATED" },
              create: {
                subtaskId: subtaskId,
                taskId: taskId,
                rangeLabel: rangeLabel,
                description: description,
                reward: ethers.formatEther(reward),
                state: "CREATED"
              }
            });
          }
          else if (event.eventName === "SubtaskClaimed") {
            const [taskId, subtaskId, worker] = event.args;
            console.log(`Event SubtaskClaimed: ${subtaskId} by ${worker}`);
            await prisma.subtask.updateMany({
              where: { subtaskId: subtaskId },
              data: { state: "CLAIMED", worker: worker }
            });
          }
          else if (event.eventName === "SubmissionProofRecorded") {
            const [taskId, subtaskId, submissionHash] = event.args;
            console.log(`Event SubmissionProofRecorded: ${subtaskId}`);
            await prisma.subtask.updateMany({
              where: { subtaskId: subtaskId },
              data: { state: "SUBMITTED", submissionHash: submissionHash }
            });
          }
          else if (event.eventName === "SubtaskVerified") {
            const [taskId, subtaskId, passed, score] = event.args;
            console.log(`Event SubtaskVerified: ${subtaskId} (passed: ${passed})`);
            await prisma.subtask.updateMany({
              where: { subtaskId: subtaskId },
              data: { 
                state: passed ? "VERIFIED" : "REJECTED",
                qualityScore: Number(score)
              }
            });
          }
        } catch (dbError) {
          console.error("DB Update Error during event sync:", dbError);
        }
      }

      lastCheckedBlock = currentBlock;
    } catch (e) {
      console.error("Manual polling error (will retry next interval):", e);
    }
  }, 10000); // Poll exactly once every 10 seconds
}
