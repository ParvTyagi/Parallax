import { Router } from "express";
import { generateWithGemini } from "../lib/gemini";
import { fetchFromIPFS, pinToIPFS } from "../lib/ipfs";
import {
  coerceSubtaskSpec,
  renderMasterSpecMarkdown,
  renderSubtaskSpecMarkdown,
  saveSpecDraft,
  type SubtaskSpec
} from "../lib/spec";
import { z } from "zod";

const router = Router();

const DecomposeRequestSchema = z.object({
  descriptionCID: z.string(),
  budget: z.string(),
  aiModel: z.string().optional()
});

function buildPrompt(masterTaskText: string, budget: string) {
  return `
You are the task orchestrator for Parallax, a decentralized microtasking network on Monad testnet.
A customer wants this master task done:

<master_task>
${masterTaskText}
</master_task>

Total budget: ${budget} MON.

Determine the number of subtasks from the requested deliverables, their complexity,
and whether they can be completed independently. Choose between 1 and 5 subtasks.
Description length is supporting context, not a formula for the subtask count.

Before writing the JSON, identify the requested outputs and apply these rules:
1. Use ONE subtask for a simple question, calculation, short list, short text,
   or small cohesive deliverable. Do not split trivial output items among workers.
2. Split substantial independent sections into separate subtasks. A section is
   substantial when it needs its own research, analysis, implementation, or
   meaningful written output. Independently researched sections remain separate
   even when they will be assembled into a single guide or report.
3. Choose the count that matches those independent work units: two units means
   two subtasks, three means three, and so on up to five. Do not default a
   multi-section research task to one subtask just because one worker could do it.
   If there are more than five units, group related units into at most five
   independently executable subtasks without dropping any requested work.
4. Every subtask must be completable from the original request without waiting
   for another worker's output. Include all relevant shared constraints in each
   subtask. Merge dependent or overlapping work into the same subtask.
5. Do not invent extra planning, research, review, summary, or validation jobs.
   Include necessary preparation and self-checking within each requested deliverable.
6. Preserve the exact requested scope, quantities, lengths, sources, and formatting.
   A requested item count is not automatically a subtask count. Do not add output
   requirements that the user did not request or that the work does not require.
7. Make each objective and acceptance criterion specific to its assigned output.
   Avoid generic criteria such as "fulfils the original request" when concrete
   requirements can be extracted from the request.
8. Divide the full budget (${budget} MON) proportionally across the chosen
   subtasks. Rewards must sum to ${budget} MON. One subtask receives the
   entire budget. Budget size alone must not determine the number of subtasks.

Calibration examples:
- "Give me 2 prime numbers between 0 and 100, only numbers."
  -> ONE subtask delivering exactly two prime numbers in range and no extra text.
- "Suggest 10 names for a coffee shop."
  -> ONE subtask delivering ten names, not ten trivial subtasks.
- "Write independent 200-300-word beginner guides to solar, wind, hydroelectric,
  and geothermal energy. Each must explain how it works, advantages, limitations,
  and common uses, with two credible sources per energy type."
  -> FOUR subtasks: solar, wind, hydroelectric, and geothermal.
  Each subtask requires its own 200-300-word section, all four requested topics,
  and two credible sources. Do not combine these four substantial sections into
  one task or add separate research and review tasks.
- "Summarize this article in 150 words" followed by a long article.
  -> ONE subtask; a long input does not imply multiple deliverables.

Check silently before returning: all requested work is covered, substantial
independent sections are separated, trivial items are grouped, and no subtask
depends on another's output. Do not include this reasoning in the response.

Each subtask is a paid contract executed by a stranger who has never seen this
conversation and cannot ask questions. Write it so that is possible:

- "objective": 1-4 sentences, scaled to the work. What to produce and why it matters. Be concrete about
  scope, quantity, and depth. Never just restate the label.
- "contextNotes": anything the worker needs but could not guess - domain constraints,
  the audience, tools, sources to prefer or avoid. Empty string if genuinely none.
- "steps": 1-6 short imperative steps, only as many as the work needs.
- "acceptanceCriteria": 1-6 necessary criteria that are OBJECTIVELY CHECKABLE by reading the
  submission alone. Each must be independently verifiable and carry a concrete,
  countable bar where possible ("covers at least 5 protocols", "every claim cites a
  source URL", "table has columns X, Y, Z"). Never write vague criteria such as
  "good quality" or "well written".
- "deliverableFormat": the exact shape of the output (e.g. "Markdown report,
  600-900 words, with a summary table and a Sources section").
- "skills": 1-4 relevant short skill tags (e.g. "research", "solidity", "data-analysis").
- "estimatedMinutes": realistic focused working minutes.
- "leaseDuration": seconds a worker gets to finish after claiming (300-7200),
  generously larger than estimatedMinutes * 60.
- "reward": MON for this subtask. All rewards together must not exceed ${budget}.

Also return the master framing:
- "masterObjective": one paragraph restating the overall goal precisely.
- "masterContext": constraints that apply across all subtasks. Empty string if none.
- "successCriteria": 1-5 necessary, checkable criteria for the final deliverable.

Return ONLY valid JSON, no markdown fences, no commentary:
{
  "masterTask": "string",
  "masterObjective": "string",
  "masterContext": "string",
  "successCriteria": ["string"],
  "subtasks": [
    {
      "rangeLabel": "string",
      "objective": "string",
      "contextNotes": "string",
      "steps": ["string"],
      "acceptanceCriteria": ["string"],
      "deliverableFormat": "string",
      "skills": ["string"],
      "estimatedMinutes": number,
      "reward": number,
      "leaseDuration": number
    }
  ]
}
`;
}

/// Preserve the complete request as one work unit if AI decomposition fails.
/// Without a usable model response, inventing independent work would add scope.
function buildFallback(masterTaskText: string, budget: string) {
  const numBudget = parseFloat(budget) || 0;
  const acceptanceCriteria = [
    "The submission fulfils the complete original request.",
    "The submission respects all requested quantities, constraints, and output formatting."
  ];

  return {
    masterTask: masterTaskText || "Master Task Specification",
    masterObjective: masterTaskText,
    masterContext: "",
    successCriteria: acceptanceCriteria,
    subtasks: [
      {
        rangeLabel: "Complete the requested task",
        objective: masterTaskText,
        contextNotes: "",
        steps: ["Produce the requested deliverable and check it against the original request."],
        acceptanceCriteria,
        deliverableFormat: "Use the format requested in the original task; otherwise use the simplest suitable format.",
        skills: [],
        reward: numBudget,
        leaseDuration: 7200
      }
    ]
  };
}

router.post("/", async (req, res) => {
  const startedAt = performance.now();
  const timings: Record<string, number> = {};
  async function timed<T>(stage: string, work: () => Promise<T>): Promise<T> {
    const stageStartedAt = performance.now();
    try {
      return await work();
    } finally {
      timings[stage] = Math.round(performance.now() - stageStartedAt);
    }
  }
  try {
    const parsed = DecomposeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const { descriptionCID, budget, aiModel } = parsed.data;

    console.log(`\n[Orchestrator] Decomposing task using model "${aiModel || "default"}"...`);
    const masterTaskText = await timed("descriptionFetchMs", () => fetchFromIPFS(descriptionCID));
    if (!masterTaskText.trim()) {
      // Decomposing a CID string instead of the brief produces garbage subtasks,
      // so fail loudly rather than letting it through.
      return res.status(422).json({
        error: `Could not read the task description behind CID ${descriptionCID}. Re-submit the task so it is pinned again.`
      });
    }

    let parsedJson: any = null;

    try {
      const text = await timed("geminiMs", () =>
        generateWithGemini(buildPrompt(masterTaskText, budget), aiModel, {
          attemptTimeoutMs: 30000,
          totalTimeoutMs: 45000
        })
      );
      const cleanJson = text.trim().replace(/```json/gi, "").replace(/```/g, "").trim();
      parsedJson = JSON.parse(cleanJson);
      if (!Array.isArray(parsedJson?.subtasks) || parsedJson.subtasks.length === 0 || parsedJson.subtasks.length > 5) {
        throw new Error("Model must return between 1 and 5 subtasks");
      }
    } catch (aiErr) {
      console.warn("[Decompose] Gemini AI decomposition fallback triggered:", aiErr);
      parsedJson = buildFallback(masterTaskText, budget);
    }

    const numBudget = parseFloat(budget) || 0;
    const fallbackReward = parsedJson.subtasks.length
      ? parseFloat((numBudget / parsedJson.subtasks.length).toFixed(4))
      : 0;

    const specs: SubtaskSpec[] = parsedJson.subtasks.map((raw: any) =>
      coerceSubtaskSpec(raw, fallbackReward)
    );

    const masterObjective = String(parsedJson.masterObjective || masterTaskText || "").trim();
    const masterContext = String(parsedJson.masterContext || "").trim();
    const successCriteria: string[] = Array.isArray(parsedJson.successCriteria)
      ? parsedJson.successCriteria.map((s: any) => String(s)).filter((s: string) => s.trim())
      : [];

    // Pin the master brief as rendered markdown so the on-chain CID resolves to
    // something a human can actually read, not a bare sentence.
    const masterMarkdown = renderMasterSpecMarkdown(parsedJson.masterTask || masterTaskText, {
      objective: masterObjective,
      contextNotes: masterContext,
      successCriteria
    });
    // Each spec is independent: pin and persist them concurrently, keeping
    // each draft write after its own CID is available. Await all before responding.
    const [masterTaskCID] = await timed("specPersistenceMs", () => Promise.all([
      (async () => {
        const cid = await pinToIPFS(masterMarkdown);
        await saveSpecDraft(cid, "MASTER", {
          title: "Master Task",
          objective: masterObjective,
          contextNotes: masterContext,
          acceptanceCriteria: successCriteria,
          markdown: masterMarkdown
        });
        return cid;
      })(),
      ...specs.map(async (spec) => {
        const markdown = renderSubtaskSpecMarkdown(spec, masterObjective);
        spec.description = markdown;
        spec.descriptionCID = await pinToIPFS(markdown);
        await saveSpecDraft(spec.descriptionCID, "SUBTASK", {
          title: spec.rangeLabel,
          objective: spec.objective,
          contextNotes: spec.contextNotes,
          acceptanceCriteria: spec.acceptanceCriteria,
          deliverableFormat: spec.deliverableFormat,
          skills: spec.skills,
          estimatedMinutes: spec.estimatedMinutes,
          markdown
        });
        return spec.descriptionCID;
      })
    ]));

    res.json({
      masterTask: parsedJson.masterTask || masterTaskText,
      masterObjective,
      masterContext,
      successCriteria,
      masterTaskCID,
      subtasks: specs
    });
  } catch (error: any) {
    console.error("Error in decompose:", error);
    res.status(500).json({ error: error?.message || "Internal server error" });
  } finally {
    console.log("[Decompose] Timings:", {
      ...timings,
      totalMs: Math.round(performance.now() - startedAt)
    });
  }
});

/// Re-pins an edited subtask spec. The frontend calls this when the creator changes
/// anything in the review modal, so the CID that goes on-chain always matches the
/// structured spec stored against it.
router.post("/respec", async (req, res) => {
  try {
    const spec = coerceSubtaskSpec(req.body, Number(req.body?.reward) || 0);
    const markdown = renderSubtaskSpecMarkdown(spec, String(req.body?.masterObjective || ""));
    const cid = await pinToIPFS(markdown);
    await saveSpecDraft(cid, "SUBTASK", {
      title: spec.rangeLabel,
      objective: spec.objective,
      contextNotes: spec.contextNotes,
      acceptanceCriteria: spec.acceptanceCriteria,
      deliverableFormat: spec.deliverableFormat,
      skills: spec.skills,
      estimatedMinutes: spec.estimatedMinutes,
      markdown
    });
    res.json({ cid, markdown, spec });
  } catch (error: any) {
    console.error("Error in respec:", error);
    res.status(500).json({ error: error?.message || "Internal server error" });
  }
});

export default router;
