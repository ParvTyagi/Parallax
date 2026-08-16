import { ethers } from "ethers";
import { prisma } from "../db/client";
import dotenv from "dotenv";

dotenv.config();

const TASK_MANAGER_ABI = [
  "event TaskCreated(bytes32 indexed taskId, address indexed creator, uint256 budget, string description)",
  "event SubtaskCreated(bytes32 indexed taskId, bytes32 indexed subtaskId, string rangeLabel, string description, uint256 reward, uint256 leaseDuration)",
  "event SubtaskClaimed(bytes32 indexed taskId, bytes32 indexed subtaskId, address indexed worker)",
  "event ClaimForfeited(bytes32 indexed taskId, bytes32 indexed subtaskId)",
  "event SubmissionProofRecorded(bytes32 indexed taskId, bytes32 indexed subtaskId, bytes32 submissionHash)",
  "event SubtaskVerified(bytes32 indexed taskId, bytes32 indexed subtaskId, bool passed, uint8 score)"
];

// We will simulate AI aggregation off-chain here when all tasks are verified.
import { geminiModel } from "./gemini";

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
            const [taskId, creator, budget, description] = event.args;
            console.log(`Event TaskCreated: ${taskId}`);
            await prisma.task.upsert({
              where: { taskId: taskId },
              update: { status: "ACTIVE" },
              create: {
                taskId: taskId,
                creator: creator,
                description: description,
                budget: ethers.formatEther(budget),
                status: "ACTIVE"
              }
            });
          }
          else if (event.eventName === "SubtaskCreated") {
            const [taskId, subtaskId, rangeLabel, description, reward, leaseDuration] = event.args;
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
                leaseDuration: Number(leaseDuration),
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
          else if (event.eventName === "ClaimForfeited") {
            const [taskId, subtaskId] = event.args;
            console.log(`Event ClaimForfeited: ${subtaskId}`);
            await prisma.subtask.updateMany({
              where: { subtaskId: subtaskId },
              data: { state: "CREATED", worker: null }
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
                worker: passed ? undefined : null,
                qualityScore: Number(score)
              }
            });

            // Check if master task is complete for aggregation
            if (passed) {
              const task = await prisma.task.findUnique({
                where: { taskId: taskId },
                include: { subtasks: { include: { submissions: { orderBy: { createdAt: 'desc' }, take: 1 } } } }
              });

              if (task) {
                const allVerified = task.subtasks.every(st => st.state === "VERIFIED");
                if (allVerified && task.status !== "COMPLETED") {
                  console.log(`[Aggregation] All subtasks verified for task ${taskId}! Triggering aggregation...`);
                  
                  // Gather all submissions
                  const allWork = task.subtasks.map(st => `[Subtask: ${st.description}]\nWorker Output: ${st.submissions[0]?.storagePath || "No data"}\n`).join("\n");
                  
                  const prompt = `You are a synthesis AI. We have a master task: "${task.description}".
The workers have completed the subtasks. Here are their submissions:
${allWork}

Synthesize these submissions into a single cohesive, well-formatted final solution for the master task. Return ONLY the final output markdown text.`;

                  try {
                    const aiResult = await geminiModel.generateContent(prompt);
                    const finalSolution = aiResult.response.text().trim();
                    
                    await prisma.task.update({
                      where: { taskId: taskId },
                      data: { status: "COMPLETED", solution: finalSolution }
                    });
                    console.log(`[Aggregation] Task ${taskId} successfully aggregated and marked COMPLETED.`);
                  } catch (aggErr) {
                    console.error("[Aggregation] Failed to aggregate solution:", aggErr);
                  }
                }
              }
            }
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
