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
  console.log(`\n\n[Orchestrator] POST /trigger-verification called with body:`, req.body);
  try {
    const { subtaskId } = req.body;
    if (!subtaskId) {
      console.error("[Orchestrator] Missing subtaskId in request");
      return res.status(400).json({ error: "Missing subtaskId" });
    }

    console.log(`[Orchestrator] Fetching subtask ${subtaskId} from database...`);
    // Fetch the subtask and latest submission
    const subtask = await prisma.subtask.findUnique({
      where: { subtaskId },
      include: { submissions: { orderBy: { createdAt: 'desc' }, take: 1 }, task: true }
    });

    if (!subtask || subtask.submissions.length === 0) {
      console.error(`[Orchestrator] Subtask or submission not found for ID: ${subtaskId}`);
      return res.status(404).json({ error: "Subtask or submission not found" });
    }

    const submission = subtask.submissions[0];
    const workerSubmission = submission.storagePath; // Content stored here for MVP
    console.log(`[Orchestrator] Found worker submission (length: ${workerSubmission.length})`);

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

    console.log(`[Orchestrator] Calling Gemini AI for verification...`);
    const aiResult = await geminiModel.generateContent(prompt);
    const text = aiResult.response.text().trim().replace(/```json/g, "").replace(/```/g, "");
    console.log(`[Orchestrator] Gemini AI responded:\n`, text);
    
    let parsedJson;
    try {
      parsedJson = JSON.parse(text);
    } catch (e) {
      console.error(`[Orchestrator] Failed to parse AI JSON response:`, text);
      throw new Error("AI returned invalid JSON");
    }
    
    const passed = parsedJson.passed === true;
    const score = parsedJson.score || 0;

    // Send Orchestrator transaction to Monad Testnet
    const rpcUrl = process.env.MONAD_RPC_URL;
    const pk = process.env.ORCHESTRATOR_PRIVATE_KEY;
    const taskManagerAddress = process.env.TASKMANAGER_ADDRESS;

    if (rpcUrl && pk && taskManagerAddress) {
      console.log(`[Orchestrator] Preparing to sign transaction on Monad Testnet...`);
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(pk, provider);
      const contract = new ethers.Contract(taskManagerAddress, TASK_MANAGER_ABI, wallet);

      console.log(`[Orchestrator] Calling verifySubtask on-chain for ${subtaskId} with pass=${passed}, score=${score}...`);
      try {
        const tx = await contract.verifySubtask(
          subtask.taskId,
          subtaskId,
          passed,
          score,
          { gasLimit: 3000000 } // Add manual gas limit to prevent estimation crashes
        );
        console.log(`[Orchestrator] Transaction broadcasted! Hash: ${tx.hash}`);
        console.log(`[Orchestrator] Waiting for transaction to be mined...`);
        await tx.wait();
        console.log(`[Orchestrator] TX Mined and Confirmed!`);
      } catch (txError) {
        console.error(`[Orchestrator] CRITICAL ERROR: Smart Contract execution reverted!`, txError);
      }
    } else {
      console.warn("[Orchestrator] Credentials missing. Skipping on-chain verification transaction.");
    }

    console.log(`[Orchestrator] Sending success response to frontend.`);
    res.json({
      success: true,
      aiEvaluation: parsedJson
    });
  } catch (error) {
    console.error("[Orchestrator] Error in orchestrator verification catch block:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
