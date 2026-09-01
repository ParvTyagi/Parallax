import { Router } from "express";
import { prisma } from "../db/client";
import { fetchFromIPFS } from "../lib/ipfs";
import { syncTransaction } from "../lib/chain";
import { z } from "zod";

const router = Router();

async function resolveSubtaskText(st: any) {
  if (!st) return st;
  const descText = await fetchFromIPFS(st.description);
  let submissionContent = "";
  if (st.submissions && st.submissions.length > 0) {
    submissionContent = await fetchFromIPFS(st.submissions[0].storagePath || st.submissions[0].contentHash);
  }
  return {
    ...st,
    description: descText || st.description,
    descriptionCID: st.description,
    submissionContent
  };
}

async function resolveTaskText(task: any) {
  if (!task) return task;
  const taskDescText = await fetchFromIPFS(task.description);
  const resolvedSubtasks = await Promise.all((task.subtasks || []).map(resolveSubtaskText));
  return {
    ...task,
    description: taskDescText || task.description,
    descriptionCID: task.description,
    subtasks: resolvedSubtasks
  };
}

/// Wallets, decoded events, and hand-typed URLs disagree on address casing, so
/// every address filter is case-insensitive.
const addressFilter = (address: string) => ({
  equals: address,
  mode: "insensitive" as const
});

/// Indexes a just-confirmed transaction instead of waiting for the block poller.
/// The receipt is re-read server-side, so this cannot fabricate a task.
const SyncSchema = z.object({ txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/) });

router.post("/sync", async (req, res) => {
  const parsed = SyncSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "A valid txHash is required" });
  }

  try {
    const result = await syncTransaction(parsed.data.txHash);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Error syncing transaction:", error);
    res.status(502).json({ error: error?.message || "Failed to sync transaction" });
  }
});

// Get all open subtasks for workers to claim
router.get(["/open-subtasks", "/subtasks/open"], async (req, res) => {
  try {
    const subtasks = await prisma.subtask.findMany({
      where: { worker: null, state: "CREATED", task: { status: { notIn: ["CANCELLED", "COMPLETED"] } } },
      include: { task: true },
      orderBy: { createdAt: "desc" }
    });
    const resolved = await Promise.all(
      subtasks.map(async (st) => {
        const descText = await fetchFromIPFS(st.description);
        const taskDescText = st.task ? await fetchFromIPFS(st.task.description) : "";
        return {
          ...st,
          description: descText || st.description,
          descriptionCID: st.description,
          task: st.task ? { ...st.task, description: taskDescText || st.task.description } : st.task
        };
      })
    );
    res.json(resolved);
  } catch (error) {
    console.error("Error fetching subtasks:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all tasks created by a specific customer
router.get("/customer/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const tasks = await prisma.task.findMany({
      where: { creator: addressFilter(address) },
      orderBy: { createdAt: "desc" },
      include: { subtasks: { orderBy: { createdAt: "asc" } } }
    });
    const resolved = await Promise.all(tasks.map(resolveTaskText));
    res.json(resolved);
  } catch (error) {
    console.error("Error fetching customer tasks:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all subtasks claimed by a specific worker
router.get("/worker/:address", async (req, res) => {
  try {
    const { address } = req.params;
    const subtasks = await prisma.subtask.findMany({
      where: { worker: addressFilter(address) },
      orderBy: { createdAt: "desc" },
      include: { task: true }
    });
    const resolved = await Promise.all(subtasks.map(resolveSubtaskText));
    res.json(resolved);
  } catch (error) {
    console.error("Error fetching worker tasks:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all subtasks currently disputed, for the admin resolution queue
router.get("/disputes/open", async (req, res) => {
  try {
    const subtasks = await prisma.subtask.findMany({
      where: { state: "IN_DISPUTE" },
      orderBy: { createdAt: "desc" },
      include: { task: true }
    });
    const resolved = await Promise.all(subtasks.map(resolveSubtaskText));
    res.json(resolved);
  } catch (error) {
    console.error("Error fetching open disputes:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get a specific task and its full state for the execution visualizer
router.get("/:taskId", async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await prisma.task.findUnique({
      where: { taskId },
      include: {
        subtasks: {
          orderBy: { createdAt: "asc" },
          include: { submissions: { orderBy: { createdAt: "desc" }, take: 1 } }
        }
      }
    });

    if (!task) return res.status(404).json({ error: "Task not found" });
    const resolved = await resolveTaskText(task);
    res.json(resolved);
  } catch (error) {
    console.error("Error fetching task:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Backwards-compatible alias; two segments, so no collision with GET /:taskId.
router.get("/worker-profile/:address", (req, res, next) => {
  req.url = `/${req.params.address}`;
  workersRouter(req, res, next);
});

export default router;

/// Mounted at /api/workers. Kept separate from the tasks router, whose
/// `GET /:taskId` would otherwise swallow `GET /api/workers/0x…`.
export const workersRouter = Router();

workersRouter.get("/:address", async (req, res) => {
  try {
    const { address } = req.params;
    let profile = await prisma.workerProfile.findFirst({
      where: { address: addressFilter(address) }
    });

    if (!profile) {
      profile = { address, successfulTasks: 0, failedTasks: 0, reputationScore: 0 } as any;
    }

    const claimedSubtasks = await prisma.subtask.findMany({
      where: { worker: addressFilter(address) },
      orderBy: { createdAt: "desc" },
      include: { task: true }
    });

    const resolvedSubtasks = await Promise.all(claimedSubtasks.map(resolveSubtaskText));

    // Bonds still locked on-chain: any subtask this worker holds that hasn't reached a final,
    // bond-released state yet.
    const activeBondTotal = claimedSubtasks
      .filter((st) => ["CLAIMED", "SUBMITTED", "PENDING_RELEASE", "IN_DISPUTE"].includes(st.state))
      .reduce((sum, st) => sum + Number(st.bondAmount || 0), 0);

    res.json({
      address,
      profile: { ...profile, activeBondTotal },
      claimedSubtasks: resolvedSubtasks,
      ...profile,
      activeBondTotal
    });
  } catch (error) {
    console.error("Failed to fetch worker profile:", error);
    res.status(500).json({ error: "Failed to fetch worker profile" });
  }
});
