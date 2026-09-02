import { fetchFromIPFS } from "./ipfs";
import { prisma } from "../db/client";
import { generateWithGemini } from "./gemini";
import { sendOrchestratorTx } from "./orchestrator";
import dotenv from "dotenv";

dotenv.config();

export async function startJobWorker() {
  console.log("Starting durable DB job worker...");
  startPayoutSweeper();

  setInterval(async () => {
    try {
      // Claims one job atomically. SKIP LOCKED guarantees two workers never
      // take the same row, which would double-send its on-chain transaction.
      // `updatedAt` is set here because @updatedAt is applied by Prisma Client,
      // not the database, and this bypasses it.
      const claimed = await prisma.$queryRaw<
        Array<{ id: string; type: string; payload: any; attempts: number }>
      >`
        UPDATE "Job"
        SET status = 'PROCESSING', attempts = attempts + 1, "updatedAt" = NOW()
        WHERE id = (
          SELECT id FROM "Job"
          WHERE status = 'PENDING'
          ORDER BY "createdAt" ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id, type, payload, attempts
      `;

      const job = claimed[0];
      if (!job) return;

      console.log(`[Worker] Processing Job ${job.id} of type ${job.type}`);

      try {
        if (job.type === "VERIFY") {
          await handleVerify(job.payload as any);
        } else if (job.type === "AGGREGATE") {
          await handleAggregate(job.payload as any);
        }

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
            // `attempts` is already incremented by the claim, so this retires a
            // job after 3 total attempts.
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

  const workerSubmissionCID = subtask.submissions[0].storagePath;
  const workerSubmissionText = await fetchFromIPFS(workerSubmissionCID);

  const subtaskRequirementText = await fetchFromIPFS(subtask.description);

  // Grading against the stored criteria keeps the verdict auditable and lets a
  // worker see exactly which bar they missed.
  const criteria = subtask.acceptanceCriteria || [];
  const { passed, score, reasons, criteriaResults } = await runVerification({
    label: subtask.rangeLabel,
    objective: subtask.objective || "",
    requirement: subtaskRequirementText,
    deliverableFormat: subtask.deliverableFormat || "",
    criteria,
    submission: workerSubmissionText
  });

  await prisma.subtask.update({
    where: { subtaskId },
    data: {
      aiRationale: reasons.join("\n"),
      criteriaResults: criteriaResults as any,
      aiFlags: criteriaResults.filter((c) => !c.met).map((c) => c.criterion)
    }
  });

  await sendOrchestratorTx(`verifySubtask ${subtaskId.slice(0, 10)}`, (contract, overrides) =>
    contract.verifySubtask(subtask.taskId, subtaskId, passed, score, overrides)
  );
}

export interface CriterionResult {
  criterion: string;
  met: boolean;
  note: string;
}

export interface VerificationResult {
  passed: boolean;
  score: number;
  reasons: string[];
  criteriaResults: CriterionResult[];
}

/// Runs the criterion-by-criterion QA pass. Shared by the durable job worker and
/// the /api/verify preview endpoint so both grade identically.
export async function runVerification(input: {
  label?: string;
  objective?: string;
  requirement: string;
  deliverableFormat?: string;
  criteria: string[];
  submission: string;
}): Promise<VerificationResult> {
  const criteriaBlock = input.criteria.length
    ? input.criteria.map((c, i) => `${i + 1}. ${c}`).join("\n")
    : "(No explicit criteria were recorded. Judge against the requirement text alone.)";

  const prompt = `
You are a strict QA verifier on the Parallax compute network. Real money is released
on your verdict, so be exacting but fair. Judge only what is present in the submission.

SUBTASK: ${input.label || "Subtask"}
OBJECTIVE: ${input.objective || "(see requirement)"}
FULL REQUIREMENT:
<requirement>
${input.requirement}
</requirement>

REQUIRED DELIVERABLE FORMAT: ${input.deliverableFormat || "(unspecified)"}

ACCEPTANCE CRITERIA (grade each one independently):
${criteriaBlock}

WORKER SUBMISSION:
<submission>
${input.submission}
</submission>

For EVERY acceptance criterion, decide whether the submission meets it and give a
one-sentence note quoting or pointing to the specific evidence. Do not mark a
criterion met on the assumption that content exists elsewhere.

Then score 0-100 overall, weighted by how many criteria are met and how well.
"passed" is true only if the score is >= 70 AND no criterion is unmet.

Return ONLY valid JSON, no markdown fences:
{
  "criteriaResults": [{ "criterion": "string", "met": boolean, "note": "string" }],
  "score": number,
  "passed": boolean,
  "reasons": ["string"]
}
`;

  try {
    // Retries across models: this verdict releases escrowed funds, so a single
    // overloaded model must not decide it.
    const raw = await generateWithGemini(prompt);
    const text = raw.trim().replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(text);

    const criteriaResults: CriterionResult[] = Array.isArray(parsed.criteriaResults)
      ? parsed.criteriaResults.map((c: any) => ({
          criterion: String(c?.criterion || ""),
          met: c?.met === true,
          note: String(c?.note || "")
        }))
      : [];

    const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
    const allMet = criteriaResults.length === 0 || criteriaResults.every((c) => c.met);
    return {
      // Trust the criteria over the model's own boolean — it frequently passes work
      // it has just marked as failing a criterion.
      passed: parsed.passed === true && score >= 70 && allMet,
      score,
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons.map((r: any) => String(r)) : [],
      criteriaResults
    };
  } catch (err: any) {
    // Never approve work the AI could not actually grade: this verdict releases
    // escrowed MON. Throwing leaves the job to retry and the subtask SUBMITTED
    // with no transaction sent — stuck and visible beats wrongly paid.
    console.error("[Verify] Verification could not be completed:", err?.message || err);
    throw new Error(`AI verification unavailable: ${err?.message || err}`);
  }
}

/// Subtasks that passed AI verification sit in PENDING_RELEASE for a 48h creator dispute window.
/// Nothing else calls releasePayout automatically, so this sweep finalizes payouts once that
/// window elapses undisputed — otherwise funds and worker bonds would sit locked indefinitely.
function startPayoutSweeper() {
  setInterval(async () => {
    try {
      const releasable = await prisma.subtask.findMany({
        where: { state: "PENDING_RELEASE", disputeDeadline: { lte: new Date() } }
      });

      if (releasable.length === 0) return;

      for (const subtask of releasable) {
        try {
          await sendOrchestratorTx(
            `releasePayout ${subtask.subtaskId.slice(0, 10)}`,
            (contract, overrides) =>
              contract.releasePayout(subtask.taskId, subtask.subtaskId, overrides)
          );
          console.log(`[PayoutSweeper] Released payout for subtask ${subtask.subtaskId}`);
        } catch (err: any) {
          console.error(`[PayoutSweeper] Failed to release ${subtask.subtaskId}:`, err.message);
        }
      }
    } catch (e) {
      console.error("Payout sweeper error:", e);
    }
  }, 60000); // Check once a minute
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

  const finalSolution = (await generateWithGemini(prompt)).trim();
  
  await prisma.task.update({
    where: { taskId },
    data: { status: "COMPLETED", solution: finalSolution }
  });
}
