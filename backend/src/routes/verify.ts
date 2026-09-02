import { Router } from "express";
import { prisma } from "../db/client";
import { fetchFromIPFS } from "../lib/ipfs";
import { runVerification } from "../lib/worker";
import { z } from "zod";

const router = Router();

const VerifyRequestSchema = z.object({
  subtaskDescription: z.string(),
  workerSubmission: z.string(),
  /// Optional: when supplied, the preview grades against the same stored acceptance
  /// criteria the on-chain verifier will use, so a worker's self-check matches the
  /// real verdict instead of being a looser second opinion.
  subtaskId: z.string().optional()
});

router.post("/", async (req, res) => {
  try {
    const parsed = VerifyRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const { subtaskDescription, workerSubmission, subtaskId } = parsed.data;

    let criteria: string[] = [];
    let label = "";
    let objective = "";
    let deliverableFormat = "";
    let requirement = subtaskDescription;

    if (subtaskId) {
      const subtask = await prisma.subtask.findUnique({ where: { subtaskId } });
      if (subtask) {
        criteria = subtask.acceptanceCriteria || [];
        label = subtask.rangeLabel;
        objective = subtask.objective || "";
        deliverableFormat = subtask.deliverableFormat || "";
        requirement = (await fetchFromIPFS(subtask.description)) || subtaskDescription;
      }
    }

    const result = await runVerification({
      label,
      objective,
      requirement,
      deliverableFormat,
      criteria,
      submission: workerSubmission
    });

    res.json(result);
  } catch (error: any) {
    console.error("Error in verify:", error);
    res.status(500).json({ error: error?.message || "Internal server error" });
  }
});

export default router;
