import { Router } from "express";
import { prisma } from "../db/client";
import { geminiModel } from "../lib/gemini";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const router = Router();

const TASK_MANAGER_ABI = [
  "function verifySubtask(bytes32 taskId, bytes32 subtaskId, bool passed, uint8 score) external"
];

router.post("/trigger-verification", async (req, res) => {
  try {
    const { subtaskId } = req.body;
    if (!subtaskId) return res.status(400).json({ error: "Missing subtaskId" });

    // Fetch the subtask and latest submission
    const subtask = await prisma.subtask.findUnique({
      where: { subtaskId },
      include: { submissions: { orderBy: { createdAt: 'desc' }, take: 1 }, task: true }
    });

    if (!subtask || subtask.submissions.length === 0) {
      return res.status(404).json({ error: "Subtask or submission not found" });
    }

    const submission = subtask.submissions[0];
    const workerSubmission = submission.storagePath; // Content stored here for MVP

    // AI Verification
    const prompt = `
You are a strict QA verifier.
Task requirements: "${subtask.description}"
Worker submission: "${workerSubmission}"

Evaluate the submission. Did the worker provide the requested information?
Score the work from 0 to 100.
If the score is >= 70, passed is true.

Return ONLY valid JSON:
{
  "passed": boolean,
  "score": number,
  "reasons": ["string"]
}
`;

    const aiResult = await geminiModel.generateContent(prompt);
    const text = aiResult.response.text().trim().replace(/```json/g, "").replace(/```/g, "");
    
    const parsedJson = JSON.parse(text);
    const passed = parsedJson.passed === true;
    const score = parsedJson.score || 0;

    // Send Orchestrator transaction to Monad Testnet
    const rpcUrl = process.env.MONAD_RPC_URL;
    const pk = process.env.ORCHESTRATOR_PRIVATE_KEY;
    const taskManagerAddress = process.env.TASKMANAGER_ADDRESS;

    if (rpcUrl && pk && taskManagerAddress) {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(pk, provider);
      const contract = new ethers.Contract(taskManagerAddress, TASK_MANAGER_ABI, wallet);

      console.log(`Orchestrator calling verifySubtask on-chain for ${subtaskId} with pass=${passed}`);
      const tx = await contract.verifySubtask(
        subtask.taskId,
        subtaskId,
        passed,
        score
      );
      await tx.wait();
      console.log(`Orchestrator TX Confirmed: ${tx.hash}`);
    } else {
      console.warn("Orchestrator credentials missing. Skipping on-chain verification transaction.");
    }

    res.json({
      success: true,
      aiEvaluation: parsedJson
    });
  } catch (error) {
    console.error("Error in orchestrator verification:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
