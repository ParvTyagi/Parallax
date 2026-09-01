import { ethers } from "ethers";
import { prisma } from "../db/client";
import { getSpecDraft } from "./spec";
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

/// The Monad testnet public RPC rejects `eth_getLogs` ranges wider than 100 blocks
/// (see scripts/backfill.js, which chunks at 99 for the same reason). Backfilling
/// after downtime can span thousands of blocks, so every scan is chunked.
const MAX_BLOCK_SPAN = Number(process.env.CHAIN_MAX_BLOCK_SPAN || 99);
const POLL_INTERVAL_MS = Number(process.env.CHAIN_POLL_INTERVAL_MS || 5000);

function getProvider() {
  const rpcUrl = process.env.MONAD_RPC_URL;
  if (!rpcUrl) return null;
  return new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
}

export function getTaskManagerInterface() {
  return new ethers.Interface(TASK_MANAGER_ABI);
}

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

/// Applies one decoded contract event to the database.
///
/// Shared by the block poller and by the receipt-based sync endpoint, so a task
/// created in the browser can be indexed the instant its transaction confirms
/// instead of waiting a full poll cycle. Every write is an upsert/updateMany, so
/// replaying the same event is harmless.
export async function applyEvent(
  eventName: string,
  args: readonly any[],
  meta: { blockNumber?: number } = {}
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
          blockNumber: meta.blockNumber ?? undefined,
          ...(spec
            ? { objective: spec.objective, successCriteria: spec.acceptanceCriteria }
            : {})
        },
        create: {
          taskId,
          creator,
          description,
          budget: ethers.formatEther(budget),
          status: "ACTIVE",
          blockNumber: meta.blockNumber ?? null,
          objective: spec?.objective ?? null,
          successCriteria: spec?.acceptanceCriteria ?? []
        }
      });
      break;
    }

    case "TaskCancelled": {
      const [taskId, , refundedAmount] = args;
      console.log(`Event TaskCancelled: ${taskId}, refunded: ${ethers.formatEther(refundedAmount)} MON`);
      await prisma.task.updateMany({ where: { taskId }, data: { status: "CANCELLED" } });
      await prisma.subtask.updateMany({
        where: { taskId, state: "CREATED" },
        data: { state: "CANCELLED" }
      });
      break;
    }

    case "SubtaskCreated": {
      const [taskId, subtaskId, rangeLabel, description, reward, leaseDuration] = args;
      console.log(`Event SubtaskCreated: ${subtaskId}`);

      // The contract only carries the IPFS CID. The structured spec (objective,
      // acceptance criteria, deliverable format) was stashed against that CID at
      // decompose time — pull it back so workers and the verifier can use it.
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
        where: { subtaskId },
        data: { state: "CLAIMED", worker, bondAmount: ethers.formatEther(bondAmount) }
      });
      break;
    }

    case "ClaimForfeited": {
      const [, subtaskId, slashed] = args;
      console.log(`Event ClaimForfeited: ${subtaskId} (slashed: ${slashed})`);
      await prisma.subtask.updateMany({
        where: { subtaskId },
        data: { state: "CREATED", worker: null, bondAmount: null }
      });
      break;
    }

    case "SubmissionProofRecorded": {
      const [, subtaskId, submissionCID] = args;
      console.log(`Event SubmissionProofRecorded: ${subtaskId} (CID: ${submissionCID})`);
      await prisma.subtask.updateMany({
        where: { subtaskId },
        data: { state: "SUBMITTED", submissionHash: submissionCID }
      });

      // Only queue one VERIFY job per submission proof — a replayed event
      // (poller + receipt sync seeing the same log) must not double-verify.
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
      // `passed` here only reflects the AI's verdict, NOT a final payout — a pass moves the
      // subtask into PENDING_RELEASE, where it sits for 48h so the creator can dispute it.
      const [, subtaskId, passed, score, disputeDeadline] = args;
      console.log(`Event SubtaskVerified: ${subtaskId} (passed: ${passed})`);
      await prisma.subtask.updateMany({
        where: { subtaskId },
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
      break;
    }

    case "PayoutReleased": {
      const [taskId, subtaskId, worker] = args;
      console.log(`Event PayoutReleased: ${subtaskId} to ${worker}`);
      await prisma.subtask.updateMany({
        where: { subtaskId },
        data: { state: "VERIFIED", bondAmount: null }
      });
      await maybeQueueAggregate(taskId);
      break;
    }

    case "DisputeRaised": {
      const [taskId, subtaskId, creator] = args;
      console.log(`Event DisputeRaised: ${subtaskId} by ${creator}`);
      await prisma.subtask.updateMany({ where: { subtaskId }, data: { state: "IN_DISPUTE" } });
      await prisma.task.updateMany({ where: { taskId }, data: { status: "IN_DISPUTE" } });
      break;
    }

    case "DisputeResolved": {
      const [taskId, subtaskId, workerWins] = args;
      console.log(`Event DisputeResolved: ${subtaskId} (workerWins: ${workerWins})`);
      await prisma.subtask.updateMany({
        where: { subtaskId },
        data: {
          state: workerWins ? "VERIFIED" : "REJECTED",
          bondAmount: null,
          worker: workerWins ? undefined : null
        }
      });

      // Restore the task's status from IN_DISPUTE if no other subtask is still disputed.
      const task = await prisma.task.findUnique({ where: { taskId }, include: { subtasks: true } });
      if (task && !task.subtasks.some((st) => st.state === "IN_DISPUTE")) {
        await prisma.task.updateMany({
          where: { taskId, status: "IN_DISPUTE" },
          data: { status: "ACTIVE" }
        });
      }

      if (workerWins) await maybeQueueAggregate(taskId);
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

/// Indexes a single transaction directly from its receipt.
///
/// The block poller can lag by a poll interval or more, which made freshly
/// created tasks invisible in the dashboard. The frontend calls this with the
/// createTask transaction hash the moment it confirms. It is trustless: the
/// receipt is re-fetched from the RPC and the logs re-decoded server-side, so a
/// caller cannot inject a task that was never mined.
export async function syncTransaction(txHash: string): Promise<{ indexed: number; taskIds: string[] }> {
  const provider = getProvider();
  const taskManagerAddress = process.env.TASKMANAGER_ADDRESS;
  if (!provider || !taskManagerAddress) {
    throw new Error("Chain sync unavailable: MONAD_RPC_URL or TASKMANAGER_ADDRESS missing");
  }

  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) throw new Error("Transaction not found or not yet mined");
  if (receipt.status !== 1) throw new Error("Transaction reverted on-chain");

  const iface = getTaskManagerInterface();
  const target = taskManagerAddress.toLowerCase();
  const taskIds = new Set<string>();
  let indexed = 0;

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== target) continue;
    let parsed;
    try {
      parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
    } catch {
      continue; // Event not in our ABI.
    }
    if (!parsed) continue;

    await applyEvent(parsed.name, parsed.args, { blockNumber: receipt.blockNumber });
    indexed++;
    if (parsed.name === "TaskCreated" || parsed.name === "SubtaskCreated") {
      taskIds.add(String(parsed.args[0]));
    }
  }

  return { indexed, taskIds: [...taskIds] };
}

async function loadCursor(contractAddress: string, currentBlock: number): Promise<number> {
  const id = contractAddress.toLowerCase();
  const existing = await prisma.chainCursor.findUnique({ where: { id } });
  if (existing) return existing.lastBlock;

  // First ever boot: start from the configured deployment block so historic tasks
  // are backfilled, falling back to a short lookback if it is not configured.
  const startBlock = Number(process.env.CHAIN_START_BLOCK || 0);
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
    console.warn("Chain listeners skipped: MONAD_RPC_URL or TASKMANAGER_ADDRESS missing.");
    return;
  }

  const contract = new ethers.Contract(taskManagerAddress, TASK_MANAGER_ABI, provider);
  console.log("Starting chain polling with a durable block cursor...");

  // setInterval would stack overlapping scans while a slow backfill runs, so the
  // loop reschedules itself only after each pass completes.
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const currentBlock = await provider.getBlockNumber();
      let cursor = await loadCursor(taskManagerAddress, currentBlock);

      while (cursor < currentBlock) {
        const from = cursor + 1;
        const to = Math.min(from + MAX_BLOCK_SPAN - 1, currentBlock);

        const events = await contract.queryFilter("*", from, to);
        for (const event of events) {
          if (!("eventName" in event) || !event.eventName) continue;
          try {
            await applyEvent(event.eventName, event.args, { blockNumber: event.blockNumber });
          } catch (dbError) {
            console.error("DB Update Error during event sync:", dbError);
          }
        }

        // Persisted per chunk: a crash mid-backfill resumes here rather than
        // rescanning, and never silently skips the range it already consumed.
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

  tick();
}
