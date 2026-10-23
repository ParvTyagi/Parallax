import { Router } from "express";
import { prisma } from "../db/client";
import { z } from "zod";
import crypto from "crypto";
import { ethers } from "ethers";
import { requestWallet } from "../lib/privateAccess";
import { pinToIPFS } from "../lib/ipfs";
import { activeTaskFilter } from "../lib/deployments";

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
    const viewer = requestWallet(req);
    if (!viewer || viewer.toLowerCase() !== worker.toLowerCase()) {
      return res.status(403).json({ error: "Connect the claiming wallet to submit work." });
    }
    const subtask = await prisma.subtask.findFirst({
      where: { subtaskId, task: activeTaskFilter() }
    });

    if (!subtask || subtask.worker?.toLowerCase() !== worker.toLowerCase()) {
      return res.status(403).json({ error: "Not authorized to submit for this subtask" });
    }
    // Hash the content for the on-chain proof
    const contentHash = "0x" + crypto.createHash("sha256").update(content).digest("hex");
    // Reuse the Pinata/IPFS path used by task descriptions. The CID is stored
    // off-chain; the frontend records the content proof returned below.
    const cid = await pinToIPFS(content);
    const submission = await prisma.submission.create({
      data: { subtaskId, worker, contentHash, storagePath: cid }
    });

    res.json({
      success: true,
      submissionId: submission.id,
      cid,
      contentHash,
      proofHash: ethers.id(content)
    });
  } catch (error) {
    console.error("Error saving submission:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
