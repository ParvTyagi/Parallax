import { Router } from "express";
import { prisma } from "../db/client";
import { z } from "zod";
import crypto from "crypto";

const router = Router();

const SubmitRequestSchema = z.object({
  subtaskId: z.string(),
  worker: z.string(),
  content: z.string()
});

router.post("/", async (req, res) => {
  try {
    const parsed = SubmitRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const { subtaskId, worker, content } = parsed.data;

    const subtask = await prisma.subtask.findUnique({
      where: { subtaskId }
    });

    if (!subtask || subtask.worker?.toLowerCase() !== worker.toLowerCase()) {
      return res.status(403).json({ error: "Not authorized to submit for this subtask" });
    }

    // Hash the content for the on-chain proof
    const contentHash = "0x" + crypto.createHash("sha256").update(content).digest("hex");

    // In a production app, we would upload to IPFS/S3 here. 
    // For the hackathon MVP, we just store it in Postgres as the storagePath placeholder.
    const submission = await prisma.submission.create({
      data: {
        subtaskId,
        worker,
        contentHash,
        storagePath: content // Storing actual content here for MVP simplicity
      }
    });

    res.json({
      success: true,
      submissionId: submission.id,
      contentHash
    });
  } catch (error) {
    console.error("Error saving submission:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
