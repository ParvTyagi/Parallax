import { Router } from "express";
import { prisma } from "../db/client";

const router = Router();

// Get all open subtasks for workers to claim
router.get("/open-subtasks", async (req, res) => {
  try {
    // A subtask is open if it has no worker assigned
    const subtasks = await prisma.subtask.findMany({
      where: { worker: null },
      include: { task: true }
    });
    res.json(subtasks);
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
    res.json(tasks);
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
    res.json(subtasks);
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
    res.json(task);
  } catch (error) {
    console.error("Error fetching task:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
