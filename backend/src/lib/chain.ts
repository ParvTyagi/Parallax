import { ethers } from "ethers";
import { prisma } from "../db/client";
import { getSpecDraft } from "./spec";
import dotenv from "dotenv";
import { getDeployments } from "./deployments";

dotenv.config();

const TASK_MANAGER_ABI = [
  "event TaskCreated(bytes32 indexed taskId, address indexed creator, uint256 budget, string description)",
  "event TaskCancelled(bytes32 indexed taskId, address indexed creator, uint256 refundedAmount)",
  "event SubtaskCreated(bytes32 indexed taskId, bytes32 indexed subtaskId, string rangeLabel, string description, uint256 reward, uint256 leaseDuration)",
  "event SubtaskClaimed(bytes32 indexed taskId, bytes32 indexed subtaskId, address indexed worker, uint256 bondAmount)",
  "event ClaimForfeited(bytes32 indexed taskId, bytes32 indexed subtaskId, bool slashed)",
  "event SubmissionProofRecorded(bytes32 indexed taskId, bytes32 indexed subtaskId, bytes32 submissionHash)",
  "event SubtaskVerified(bytes32 indexed taskId, bytes32 indexed subtaskId, bool passed, uint8 score, uint256 disputeDeadline)",
  "event SubtaskVerificationFailed(bytes32 indexed taskId, bytes32 indexed subtaskId, uint8 score)",
  "event PayoutReleased(bytes32 indexed taskId, bytes32 indexed subtaskId, address worker)",
  "event DisputeRaised(bytes32 indexed taskId, bytes32 indexed subtaskId, address indexed worker)",
  "event DisputeResolved(bytes32 indexed taskId, bytes32 indexed subtaskId, bool workerWins)",
  "event ReputationUpdated(address indexed worker, int256 newScore, uint256 successfulTasks, uint256 failedTasks)"
];

/// Public RPCs often cap eth_getLogs ranges, and backfilling after downtime
/// can span thousands of blocks, so every scan is chunked.
const MAX_BLOCK_SPAN = Number(process.env.CHAIN_MAX_BLOCK_SPAN || 99);
const POLL_INTERVAL_MS = Number(process.env.CHAIN_POLL_INTERVAL_MS || 5000);

function getProvider() {
  const rpcUrl =
    process.env.MONAD_RPC_URL ||
    process.env.RPC_URL ||
    process.env.ETH_RPC_URL ||
    process.env.ETHEREUM_RPC_URL;
  if (!rpcUrl) return null;
  return new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
}

export async function isTaskManagerAdmin(address: string): Promise<boolean> {
  const provider = getProvider();
  if (!provider) return false;
  for (const deployment of getDeployments()) {
    try {
      const contract = new ethers.Contract(
        deployment.taskManagerAddress,
        ["function admin() view returns (address)"],
        provider
      );
      if (String(await contract.admin()).toLowerCase() === address.toLowerCase()) return true;
    } catch {
      // Ignore deployments that are not available from the configured RPC.
    }
  }
  return false;
}

export function getTaskManagerInterface() {
  return new ethers.Interface(TASK_MANAGER_ABI);
}

const subtaskIdFilter = (id: any) => ({
  equals: String(id),
  mode: "insensitive" as const
});

const taskIdFilter = (id: any) => ({
  equals: String(id),
  mode: "insensitive" as const
});

/// Pushes an AGGREGATE job once every subtask on a task has reached a final,
/// paid-out state (VERIFIED via releasePayout or a worker-won dispute).
async function maybeQueueAggregate(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { taskId },
    include: { subtasks: true }
  });
  if (!task || task.subtasks.length === 0) return;

  const allFinal = task.subtasks.every((st) => st.state === "VERIFIED" || st.state === "REJECTED");
  const anyVerified = task.subtasks.some((st) => st.state === "VERIFIED");

  if (allFinal && anyVerified && task.status !== "COMPLETED" && task.status !== "SYNTHESIZING") {
    console.log(`[Queue] All subtasks finalized for task ${taskId}! Pushing AGGREGATE job...`);
    await prisma.task.update({ where: { taskId }, data: { status: "SYNTHESIZING" } });
    await prisma.job.create({
      data: { type: "AGGREGATE", payload: { taskId }, status: "PENDING" }
    });
  }
}

/// Applies one decoded contract event to the database. Shared by the block
/// poller and the receipt sync endpoint, so every write is idempotent.
export async function applyEvent(
  eventName: string,
  args: readonly any[],
  meta: { blockNumber?: number; transactionHash?: string; contractAddress?: string; escrowAddress?: string } = {}
): Promise<void> {
  switch (eventName) {
    case "TaskCreated": {
      const [taskId, creator, budget, description] = args;
      console.log(`Event TaskCreated: ${taskId}`);
      const spec = await getSpecDraft(description);
      await prisma.task.upsert({
        where: { taskId },
        update: {
          status: "ACTIVE",
          contractAddress: meta.contractAddress,
          escrowAddress: meta.escrowAddress,
          blockNumber: meta.blockNumber ?? undefined,
          txHash: meta.transactionHash ?? undefined,
          ...(spec
            ? { objective: spec.objective, successCriteria: spec.acceptanceCriteria }
            : {})
        },
        create: {
          taskId,
          creator,
          contractAddress: meta.contractAddress,
          escrowAddress: meta.escrowAddress,
          description,
          budget: ethers.formatEther(budget),
          status: "ACTIVE",
          blockNumber: meta.blockNumber ?? null,
          txHash: meta.transactionHash ?? null,
          objective: spec?.objective ?? null,
          successCriteria: spec?.acceptanceCriteria ?? []
        }
      });
      break;
    }

    case "TaskCancelled": {
      const [taskId, , refundedAmount] = args;
      console.log(`Event TaskCancelled: ${taskId}, refunded: ${ethers.formatEther(refundedAmount)} MON`);
      await prisma.task.updateMany({ where: { taskId: taskIdFilter(taskId) }, data: { status: "CANCELLED" } });
      await prisma.subtask.updateMany({
        where: { taskId: taskIdFilter(taskId), state: "CREATED" },
        data: { state: "CANCELLED" }
      });
      break;
    }

    case "SubtaskCreated": {
      const [taskId, subtaskId, rangeLabel, description, reward, leaseDuration] = args;
      console.log(`Event SubtaskCreated: ${subtaskId}`);

      // The contract only carries the CID; the structured spec was stored
      // against it at decompose time.
      const spec = await getSpecDraft(description);
      const specFields = spec
        ? {
            objective: spec.objective,
            contextNotes: spec.contextNotes,
            acceptanceCriteria: spec.acceptanceCriteria,
            deliverableFormat: spec.deliverableFormat,
            skills: spec.skills,
            estimatedMinutes: spec.estimatedMinutes
          }
        : {};

      await prisma.subtask.upsert({
        where: { subtaskId },
        update: { state: "CREATED", ...specFields },
        create: {
          subtaskId,
          taskId,
          rangeLabel,
          description,
          reward: ethers.formatEther(reward),
          leaseDuration: Number(leaseDuration),
          state: "CREATED",
          ...specFields
        }
      });
      break;
    }

    case "SubtaskClaimed": {
      const [, subtaskId, worker, bondAmount] = args;
      console.log(`Event SubtaskClaimed: ${subtaskId} by ${worker} (bond: ${ethers.formatEther(bondAmount)} MON)`);
      await prisma.subtask.updateMany({
        where: { subtaskId: subtaskIdFilter(subtaskId) },
        data: { state: "CLAIMED", worker, bondAmount: ethers.formatEther(bondAmount) }
      });
      break;
    }

    case "ClaimForfeited": {
      const [, subtaskId, slashed] = args;
      console.log(`Event ClaimForfeited: ${subtaskId} (slashed: ${slashed})`);
      await prisma.subtask.updateMany({
        where: { subtaskId: subtaskIdFilter(subtaskId) },
        data: { state: "CREATED", worker: null, bondAmount: null, submissionHash: null }
      });
      break;
    }

    case "SubmissionProofRecorded": {
      const [, subtaskId, submissionCID] = args;
      console.log(`Event SubmissionProofRecorded: ${subtaskId} (CID: ${submissionCID})`);
      await prisma.subtask.updateMany({
        where: { subtaskId: subtaskIdFilter(subtaskId) },
        data: { state: "SUBMITTED", submissionHash: submissionCID }
      });

      // One VERIFY job per proof: poller and receipt sync may see the same log.
      const existingJob = await prisma.job.findFirst({
        where: {
          type: "VERIFY",
          status: { in: ["PENDING", "PROCESSING", "COMPLETED"] },
          payload: { equals: { subtaskId } }
        }
      });
      if (!existingJob) {
        await prisma.job.create({
          data: { type: "VERIFY", payload: { subtaskId }, status: "PENDING" }
        });
        console.log(`[Queue] Pushed VERIFY job for ${subtaskId}`);
      }
      break;
    }

    case "SubtaskVerified": {
      // The active deployment pays in this transaction and has no waiting period.
      const [, subtaskId, passed, score, disputeDeadline] = args;
      if (Number(disputeDeadline) !== 0) throw new Error("Delayed payouts are not supported by the active deployment");
      console.log(`Event SubtaskVerified: ${subtaskId} (passed: ${passed})`);
      await prisma.subtask.updateMany({
        where: { subtaskId: subtaskIdFilter(subtaskId) },
        data: passed
          ? {
              state: "VERIFIED",
              qualityScore: Number(score),
              disputeDeadline: null
            }
          : {
              state: "VERIFICATION_FAILED",
              qualityScore: Number(score)
            }
      });
      break;
    }

    case "SubtaskVerificationFailed": {
      const [, subtaskId, score] = args;
      await prisma.subtask.updateMany({
        where: { subtaskId: subtaskIdFilter(subtaskId) },
        data: { state: "VERIFICATION_FAILED", qualityScore: Number(score), disputeDeadline: null }
      });
      break;
    }

    case "PayoutReleased": {
      const [taskId, subtaskId, worker] = args;
      console.log(`Event PayoutReleased: ${subtaskId} to ${worker}`);
      await prisma.subtask.updateMany({
        where: { subtaskId: subtaskIdFilter(subtaskId) },
        data: { state: "VERIFIED", bondAmount: null, disputeDeadline: null, payoutTxHash: meta.transactionHash ?? undefined }
      });
      await maybeQueueAggregate(taskId);
      break;
    }

    case "DisputeRaised": {
      const [taskId, subtaskId, creator] = args;
      console.log(`Event DisputeRaised: ${subtaskId} by ${creator}`);
      await prisma.subtask.updateMany({ where: { subtaskId: subtaskIdFilter(subtaskId) }, data: { state: "IN_DISPUTE" } });
      await prisma.task.updateMany({ where: { taskId: taskIdFilter(taskId) }, data: { status: "IN_DISPUTE" } });
      break;
    }

    case "DisputeResolved": {
      const [taskId, subtaskId, workerWins] = args;
      console.log(`Event DisputeResolved: ${subtaskId} (workerWins: ${workerWins})`);
      await prisma.subtask.updateMany({
        where: { subtaskId: subtaskIdFilter(subtaskId) },
        data: {
          state: workerWins ? "VERIFIED" : "REJECTED",
          bondAmount: null,
          payoutTxHash: workerWins ? meta.transactionHash ?? undefined : undefined
        }
      });

      // Restore the task's status from IN_DISPUTE if no other subtask is still disputed.
      const task = await prisma.task.findUnique({ where: { taskId }, include: { subtasks: true } });
      if (task && !task.subtasks.some((st) => st.state === "IN_DISPUTE")) {
        await prisma.task.updateMany({
          where: { taskId: taskIdFilter(taskId), status: "IN_DISPUTE" },
          data: { status: "ACTIVE" }
        });
      }

      await maybeQueueAggregate(taskId);
      break;
    }

    case "ReputationUpdated": {
      const [worker, newScore, successfulTasks, failedTasks] = args;
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
      break;
    }

    default:
      break;
  }
}

/// Indexes a single transaction from its receipt, so a newly created task is
/// visible without waiting for the poller. The receipt is re-fetched and decoded
/// server-side, so a caller cannot inject a task that was never mined.
export async function syncTransaction(txHash: string): Promise<{ indexed: number; taskIds: string[] }> {
  const provider = getProvider();
  const taskManagerAddress = process.env.TASKMANAGER_ADDRESS;
  if (!provider || !taskManagerAddress) {
    throw new Error("Chain sync unavailable: MONAD_RPC_URL (or RPC_URL/ETH_RPC_URL) or TASKMANAGER_ADDRESS missing");
  }

  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) throw new Error("Transaction not found or not yet mined");
  if (receipt.status !== 1) throw new Error("Transaction reverted on-chain");

  const iface = getTaskManagerInterface();
  const deployments = new Map(getDeployments().map((item) => [item.taskManagerAddress.toLowerCase(), item]));
  const taskIds = new Set<string>();
  let indexed = 0;

  for (const log of receipt.logs) {
    const deployment = deployments.get(log.address.toLowerCase());
    if (!deployment) continue;
    let parsed;
    try {
      parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
    } catch {
      continue; // Event not in our ABI.
    }
    if (!parsed) continue;

    await applyEvent(parsed.name, parsed.args, { blockNumber: receipt.blockNumber, transactionHash: txHash, contractAddress: deployment.taskManagerAddress, escrowAddress: deployment.escrowAddress });
    indexed++;
    if (parsed.name === "TaskCreated" || parsed.name === "SubtaskCreated") {
      taskIds.add(String(parsed.args[0]));
    }
  }

  return { indexed, taskIds: [...taskIds] };
}

async function loadCursor(contractAddress: string, currentBlock: number, startBlock: number): Promise<number> {
  const id = contractAddress.toLowerCase();
  const existing = await prisma.chainCursor.findUnique({ where: { id } });
  if (existing) return existing.lastBlock;

  // First ever boot: start from the configured deployment block so historic tasks
  // are backfilled, falling back to a short lookback if it is not configured.
  const initial = startBlock > 0 ? startBlock - 1 : Math.max(0, currentBlock - 200);
  await prisma.chainCursor.create({ data: { id, lastBlock: initial } });
  return initial;
}

async function saveCursor(contractAddress: string, block: number): Promise<void> {
  const id = contractAddress.toLowerCase();
  await prisma.chainCursor.upsert({
    where: { id },
    update: { lastBlock: block },
    create: { id, lastBlock: block }
  });
}

export async function setupChainListeners() {
  const provider = getProvider();
  const taskManagerAddress = process.env.TASKMANAGER_ADDRESS;

  if (!provider || !taskManagerAddress) {
    console.warn("Chain listeners skipped: MONAD_RPC_URL (or RPC_URL/ETH_RPC_URL) or TASKMANAGER_ADDRESS missing.");
    return;
  }

  for (const deployment of getDeployments()) {
  const { taskManagerAddress } = deployment;
  const contract = new ethers.Contract(taskManagerAddress, TASK_MANAGER_ABI, provider);
  console.log("Starting chain polling with a durable block cursor...");

  // Reschedules after each pass; setInterval would stack overlapping scans
  // while a slow backfill runs.
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const currentBlock = await provider.getBlockNumber();
      // Keep 1 block behind the reported head to prevent public RPC load-balancer head desync
      const safeBlock = Math.max(0, currentBlock - 1);
      let cursor = await loadCursor(taskManagerAddress, safeBlock, deployment.startBlock);

      while (cursor < safeBlock) {
        const from = cursor + 1;
        const to = Math.min(from + MAX_BLOCK_SPAN - 1, safeBlock);

        const events = await contract.queryFilter("*", from, to);
        for (const event of events) {
          if (!("eventName" in event) || !event.eventName) continue;
          try {
            await applyEvent(event.eventName, event.args, { contractAddress: deployment.taskManagerAddress, escrowAddress: deployment.escrowAddress, blockNumber: event.blockNumber, transactionHash: ("transactionHash" in event ? event.transactionHash : undefined) });
          } catch (dbError) {
            console.error("DB Update Error during event sync:", dbError);
            // Keep the cursor before this range so failed events are retried.
            throw dbError;
          }
        }

        // Persisted per chunk so a crash mid-backfill resumes here.
        cursor = to;
        await saveCursor(taskManagerAddress, cursor);
      }
    } catch (e) {
      // Cursor is not advanced on failure, so the range is retried next tick.
      console.error("Chain polling error (will retry next interval):", e);
    } finally {
      running = false;
      setTimeout(tick, POLL_INTERVAL_MS);
    }
  };

  void tick();
  }
}
