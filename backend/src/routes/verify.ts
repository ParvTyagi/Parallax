import { Router } from "express";
import { prisma } from "../db/client";
import { fetchFromIPFS } from "../lib/ipfs";
import { runVerification } from "../lib/worker";
import { z } from "zod";
import { activeTaskFilter } from "../lib/deployments";

const router = Router();

const VerifyPreviewSchema = z.object({
  subtaskDescription: z.string(),
  workerSubmission: z.string(),
  subtaskId: z.string().optional()
});

router.post("/", async (req, res) => {
  try {
    // Preview verification mode ({ subtaskDescription, workerSubmission }).
    // Settlement runs through the durable job worker after the on-chain
    // SubmissionProofRecorded event, so preview requests cannot race it.
    const previewParsed = VerifyPreviewSchema.safeParse(req.body);
    if (!previewParsed.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const { subtaskDescription, workerSubmission, subtaskId } = previewParsed.data;

    let criteria: string[] = [];
    let label = "";
    let objective = "";
    let deliverableFormat = "";
    let requirement = subtaskDescription;

    if (subtaskId) {
      const subtask = await prisma.subtask.findFirst({ where: { subtaskId, task: activeTaskFilter() } });
      if (!subtask) return res.status(404).json({ error: "Subtask not found on the active contract" });
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
