import { fetchFromIPFS } from "./ipfs";

// ... [existing imports]
import { prisma } from "../db/client";
import { geminiModel } from "./gemini";
import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const TASK_MANAGER_ABI = [
  "function verifySubtask(bytes32 taskId, bytes32 subtaskId, bool passed, uint8 score) external"
];

export async function startJobWorker() {
  console.log("Starting durable DB job worker...");

  setInterval(async () => {
    try {
      // Find a pending job
      const job = await prisma.job.findFirst({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" }
      });

      if (!job) return;

      // Mark as processing
      await prisma.job.update({
        where: { id: job.id },
        data: { status: "PROCESSING", attempts: job.attempts + 1 }
      });

      console.log(`[Worker] Processing Job ${job.id} of type ${job.type}`);

      try {
        if (job.type === "VERIFY") {
          await handleVerify(job.payload as any);
        } else if (job.type === "AGGREGATE") {
          await handleAggregate(job.payload as any);
        }

        // Mark completed
        await prisma.job.update({
          where: { id: job.id },
          data: { status: "COMPLETED" }
        });
        console.log(`[Worker] Job ${job.id} completed successfully.`);
      } catch (err: any) {
        console.error(`[Worker] Job ${job.id} failed:`, err.message);
        await prisma.job.update({
          where: { id: job.id },
          data: { 
            status: job.attempts >= 3 ? "FAILED" : "PENDING", 
            error: err.message || "Unknown error" 
          }
        });
      }
    } catch (e) {
      console.error("Job worker error:", e);
    }
  }, 5000); // Check every 5 seconds
}

async function handleVerify(payload: { subtaskId: string }) {
  const { subtaskId } = payload;
  
  const subtask = await prisma.subtask.findUnique({
    where: { subtaskId },
    include: { submissions: { orderBy: { createdAt: 'desc' }, take: 1 }, task: true }
  });

  if (!subtask || subtask.submissions.length === 0) {
    throw new Error("Subtask or submission not found");
  }

  // IPFS Fetching!
  const workerSubmissionCID = subtask.submissions[0].storagePath;
  const workerSubmissionText = await fetchFromIPFS(workerSubmissionCID);
  
  const subtaskRequirementText = await fetchFromIPFS(subtask.description);

  const prompt = `
You are a strict QA verifier.
Task requirements: "${subtaskRequirementText}"
Worker submission: "${workerSubmissionText}"

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
  
  let parsedJson;
  try {
    parsedJson = JSON.parse(text);
  } catch (e) {
    throw new Error("AI returned invalid JSON");
  }
  
  const passed = parsedJson.passed === true;
  const score = parsedJson.score || 0;

  const rpcUrl = process.env.MONAD_RPC_URL;
  const pk = process.env.ORCHESTRATOR_PRIVATE_KEY;
  const taskManagerAddress = process.env.TASKMANAGER_ADDRESS;

  if (!rpcUrl || !pk || !taskManagerAddress) {
    throw new Error("Missing orchestrator credentials");
  }

  const formattedPk = pk.startsWith('0x') ? pk : `0x${pk}`;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(formattedPk, provider);
  const contract = new ethers.Contract(taskManagerAddress, TASK_MANAGER_ABI, wallet);

  const tx = await contract.verifySubtask(subtask.taskId, subtaskId, passed, score);
  const receipt = await tx.wait();
  
  if (!receipt || receipt.status !== 1) {
    throw new Error("Transaction reverted on-chain");
  }
}

async function handleAggregate(payload: { taskId: string }) {
  const { taskId } = payload;
  
  const task = await prisma.task.findUnique({
    where: { taskId },
    include: { subtasks: { include: { submissions: { orderBy: { createdAt: 'desc' }, take: 1 } } } }
  });

  if (!task) throw new Error("Task not found");

  const masterTaskRequirementText = await fetchFromIPFS(task.description);

  // Fetch all worker submissions from IPFS in parallel
  const allWorkPromises = task.subtasks.map(async (st) => {
    const workerOutputCID = st.submissions[0]?.storagePath || "";
    const workerOutputText = await fetchFromIPFS(workerOutputCID);
    const subtaskRequirementText = await fetchFromIPFS(st.description);
    return `[Subtask Requirement: ${subtaskRequirementText}]\nWorker Output: ${workerOutputText}\n`;
  });
  
  const allWorkArray = await Promise.all(allWorkPromises);
  const allWork = allWorkArray.join("\n");
  
  const prompt = `You are a synthesis AI. We have a master task: "${masterTaskRequirementText}".
The workers have completed the subtasks. Here are their submissions:
${allWork}

Synthesize these submissions into a single cohesive, well-formatted final solution for the master task. Return ONLY the final output markdown text.`;

  const aiResult = await geminiModel.generateContent(prompt);
  const finalSolution = aiResult.response.text().trim();
  
  await prisma.task.update({
    where: { taskId },
    data: { status: "COMPLETED", solution: finalSolution }
  });
}
