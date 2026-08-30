import { ethers } from "ethers";
import { prisma } from "../db/client";
import dotenv from "dotenv";

dotenv.config();

const TASK_MANAGER_ABI = [
  "event TaskCreated(bytes32 indexed taskId, address indexed creator, uint256 budget, string description)",
  "event TaskCancelled(bytes32 indexed taskId, address indexed creator, uint256 refundedAmount)",
  "event SubtaskCreated(bytes32 indexed taskId, bytes32 indexed subtaskId, string rangeLabel, string description, uint256 reward, uint256 leaseDuration)",
  "event SubtaskClaimed(bytes32 indexed taskId, bytes32 indexed subtaskId, address indexed worker, uint256 bondAmount)",
  "event ClaimForfeited(bytes32 indexed taskId, bytes32 indexed subtaskId, bool slashed)",
  "event SubmissionProofRecorded(bytes32 indexed taskId, bytes32 indexed subtaskId, bytes32 submissionHash)",
  "event SubtaskVerified(bytes32 indexed taskId, bytes32 indexed subtaskId, bool passed, uint8 score, uint256 disputeDeadline)",
  "event PayoutReleased(bytes32 indexed taskId, bytes32 indexed subtaskId, address worker)",
  "event DisputeRaised(bytes32 indexed taskId, bytes32 indexed subtaskId, address indexed creator)",
  "event DisputeResolved(bytes32 indexed taskId, bytes32 indexed subtaskId, bool workerWins)",
  "event ReputationUpdated(address indexed worker, int256 newScore, uint256 successfulTasks, uint256 failedTasks)"
];

// We will simulate AI aggregation off-chain here when all tasks are verified.
import { geminiModel } from "./gemini";

/// Pushes an AGGREGATE job once every subtask on a task has reached a final,
/// paid-out state (VERIFIED via releasePayout or a worker-won dispute).
async function maybeQueueAggregate(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { taskId },
    include: { subtasks: true }
  });
  if (!task || task.subtasks.length === 0) return;

  const allFinal = task.subtasks.every(st => st.state === "VERIFIED" || st.state === "REJECTED");
  const anyVerified = task.subtasks.some(st => st.state === "VERIFIED");

  if (allFinal && anyVerified && task.status !== "COMPLETED" && task.status !== "SYNTHESIZING") {
    console.log(`[Queue] All subtasks finalized for task ${taskId}! Pushing AGGREGATE job...`);
    await prisma.task.update({ where: { taskId }, data: { status: "SYNTHESIZING" } });
    await prisma.job.create({
      data: {
        type: "AGGREGATE",
        payload: { taskId },
        status: "PENDING"
      }
    });
  }
}

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
          else if (event.eventName === "TaskCancelled") {
            const [taskId, creator, refundedAmount] = event.args;
            console.log(`Event TaskCancelled: ${taskId}, refunded: ${ethers.formatEther(refundedAmount)} MON`);
            await prisma.task.updateMany({
              where: { taskId: taskId },
              data: { status: "CANCELLED" }
            });
            await prisma.subtask.updateMany({
              where: { taskId: taskId, state: "CREATED" },
              data: { state: "CANCELLED" }
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
            const [taskId, subtaskId, worker, bondAmount] = event.args;
            console.log(`Event SubtaskClaimed: ${subtaskId} by ${worker} (bond: ${ethers.formatEther(bondAmount)} MON)`);
            await prisma.subtask.updateMany({
              where: { subtaskId: subtaskId },
              data: { state: "CLAIMED", worker: worker, bondAmount: ethers.formatEther(bondAmount) }
            });
          }
          else if (event.eventName === "ClaimForfeited") {
            const [taskId, subtaskId, slashed] = event.args;
            console.log(`Event ClaimForfeited: ${subtaskId} (slashed: ${slashed})`);
            await prisma.subtask.updateMany({
              where: { subtaskId: subtaskId },
              data: { state: "CREATED", worker: null, bondAmount: null }
            });
          }
          else if (event.eventName === "SubmissionProofRecorded") {
            const [taskId, subtaskId, submissionCID] = event.args;
            console.log(`Event SubmissionProofRecorded: ${subtaskId} (CID: ${submissionCID})`);
            await prisma.subtask.updateMany({
              where: { subtaskId: subtaskId },
              data: { state: "SUBMITTED", submissionHash: submissionCID }
            });
            // Queue Verification Job
            await prisma.job.create({
              data: {
                type: "VERIFY",
                payload: { subtaskId: subtaskId },
                status: "PENDING"
              }
            });
            console.log(`[Queue] Pushed VERIFY job for ${subtaskId}`);
          }
          else if (event.eventName === "SubtaskVerified") {
            // `passed` here only reflects the AI's verdict, NOT a final payout — a pass moves the
            // subtask into PENDING_RELEASE, where it sits for 48h so the creator can dispute it.
            const [taskId, subtaskId, passed, score, disputeDeadline] = event.args;
            console.log(`Event SubtaskVerified: ${subtaskId} (passed: ${passed})`);
            await prisma.subtask.updateMany({
              where: { subtaskId: subtaskId },
              data: passed
                ? {
                    state: "PENDING_RELEASE",
                    qualityScore: Number(score),
                    disputeDeadline: new Date(Number(disputeDeadline) * 1000)
                  }
                : {
                    state: "CREATED",
                    worker: null,
                    bondAmount: null,
                    submissionHash: null,
                    qualityScore: Number(score)
                  }
            });
          }
          else if (event.eventName === "PayoutReleased") {
            const [taskId, subtaskId, worker] = event.args;
            console.log(`Event PayoutReleased: ${subtaskId} to ${worker}`);
            await prisma.subtask.updateMany({
              where: { subtaskId: subtaskId },
              data: { state: "VERIFIED", bondAmount: null }
            });
            await maybeQueueAggregate(taskId);
          }
          else if (event.eventName === "DisputeRaised") {
            const [taskId, subtaskId, creator] = event.args;
            console.log(`Event DisputeRaised: ${subtaskId} by ${creator}`);
            await prisma.subtask.updateMany({
              where: { subtaskId: subtaskId },
              data: { state: "IN_DISPUTE" }
            });
            await prisma.task.updateMany({
              where: { taskId: taskId },
              data: { status: "IN_DISPUTE" }
            });
          }
          else if (event.eventName === "DisputeResolved") {
            const [taskId, subtaskId, workerWins] = event.args;
            console.log(`Event DisputeResolved: ${subtaskId} (workerWins: ${workerWins})`);
            await prisma.subtask.updateMany({
              where: { subtaskId: subtaskId },
              data: {
                state: workerWins ? "VERIFIED" : "REJECTED",
                bondAmount: null,
                worker: workerWins ? undefined : null
              }
            });

            // Restore the task's status from IN_DISPUTE if no other subtask is still disputed.
            const task = await prisma.task.findUnique({ where: { taskId }, include: { subtasks: true } });
            if (task && !task.subtasks.some(st => st.state === "IN_DISPUTE")) {
              await prisma.task.updateMany({
                where: { taskId, status: "IN_DISPUTE" },
                data: { status: "ACTIVE" }
              });
            }

            if (workerWins) {
              await maybeQueueAggregate(taskId);
            }
          }
          else if (event.eventName === "ReputationUpdated") {
            const [worker, newScore, successfulTasks, failedTasks] = event.args;
            console.log(`Event ReputationUpdated: ${worker} (score: ${newScore})`);
            await prisma.workerProfile.upsert({
              where: { address: worker },
              update: {
                reputationScore: Number(newScore),
                successfulTasks: Number(successfulTasks),
                failedTasks: Number(failedTasks)
              },
              create: {
                address: worker,
                reputationScore: Number(newScore),
                successfulTasks: Number(successfulTasks),
                failedTasks: Number(failedTasks)
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
