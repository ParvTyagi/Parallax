import { Router } from "express";
import { prisma } from "../db/client";
import { fetchFromIPFS } from "../lib/ipfs";

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
  const resolvedSubtasks = await Promise.all(
    (task.subtasks || []).map(resolveSubtaskText)
  );
  return {
    ...task,
    description: taskDescText || task.description,
    descriptionCID: task.description,
    subtasks: resolvedSubtasks
  };
}

// Get all open subtasks for workers to claim
router.get(["/open-subtasks", "/subtasks/open"], async (req, res) => {
  try {
    const subtasks = await prisma.subtask.findMany({
      where: { worker: null },
      include: { task: true },
      orderBy: { createdAt: 'desc' }
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
      where: { creator: address },
      orderBy: { createdAt: 'desc' },
      include: {
        subtasks: true
      }
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
      where: { worker: address },
      orderBy: { createdAt: 'desc' },
      include: { task: true }
    });
    const resolved = await Promise.all(subtasks.map(resolveSubtaskText));
    res.json(resolved);
  } catch (error) {
    console.error("Error fetching worker tasks:", error);
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
          include: {
            submissions: { orderBy: { createdAt: 'desc' }, take: 1 }
          }
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

// Get worker profile (Reputation & claimed subtasks)
router.get(["/worker-profile/:address", "/workers/:address"], async (req, res) => {
  try {
    const { address } = req.params;
    let profile = await prisma.workerProfile.findUnique({
      where: { address }
    });
    
    if (!profile) {
      profile = { address, successfulTasks: 0, failedTasks: 0, reputationScore: 0, stakedAmount: "0" } as any;
    }

    const claimedSubtasks = await prisma.subtask.findMany({
      where: { worker: address },
      orderBy: { createdAt: 'desc' },
      include: { task: true }
    });

    const resolvedSubtasks = await Promise.all(claimedSubtasks.map(resolveSubtaskText));

    res.json({
      address,
      profile,
      claimedSubtasks: resolvedSubtasks,
      ...profile
    });
  } catch (error) {
    console.error("Failed to fetch worker profile:", error);
    res.status(500).json({ error: "Failed to fetch worker profile" });
  }
});

export default router;
