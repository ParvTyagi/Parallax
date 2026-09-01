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
You are the task orchestrator for Parallax, a decentralized microtasking network on Monad.
A customer wants this master task done:

<master_task>
${masterTaskText}
</master_task>

Total budget: ${budget} MON.

Break it into exactly 3 to 5 subtasks that different workers can complete INDEPENDENTLY
and IN PARALLEL - no subtask may depend on another subtask's output.

Each subtask is a paid contract executed by a stranger who has never seen this
conversation and cannot ask questions. Write it so that is possible:

- "objective": 2-4 sentences. What to produce and why it matters. Be concrete about
  scope, quantity, and depth. Never just restate the label.
- "contextNotes": anything the worker needs but could not guess - domain constraints,
  the audience, tools, sources to prefer or avoid. Empty string if genuinely none.
- "steps": 3-6 short imperative steps describing a sensible approach.
- "acceptanceCriteria": 3-6 criteria that are OBJECTIVELY CHECKABLE by reading the
  submission alone. Each must be independently verifiable and carry a concrete,
  countable bar where possible ("covers at least 5 protocols", "every claim cites a
  source URL", "table has columns X, Y, Z"). Never write vague criteria such as
  "good quality" or "well written".
- "deliverableFormat": the exact shape of the output (e.g. "Markdown report,
  600-900 words, with a summary table and a Sources section").
- "skills": 2-4 short skill tags (e.g. "research", "solidity", "data-analysis").
- "estimatedMinutes": realistic focused working minutes.
- "leaseDuration": seconds a worker gets to finish after claiming (300-7200),
  generously larger than estimatedMinutes * 60.
- "reward": MON for this subtask. All rewards together must not exceed ${budget}.

Also return the master framing:
- "masterObjective": one paragraph restating the overall goal precisely.
- "masterContext": constraints that apply across all subtasks. Empty string if none.
- "successCriteria": 3-5 checkable criteria for the combined final deliverable.

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

/// Deterministic decomposition used when Gemini is unavailable or returns junk.
/// Still produces real acceptance criteria so the verifier has something to grade.
function buildFallback(masterTaskText: string, budget: string) {
  const numBudget = parseFloat(budget) || 10;
  const share = parseFloat((numBudget / 3).toFixed(4));
  const remainder = parseFloat((numBudget - share * 2).toFixed(4));
  const topic = masterTaskText.slice(0, 160);

  return {
    masterTask: masterTaskText || "Master Task Specification",
    masterObjective: masterTaskText,
    masterContext: "",
    successCriteria: [
      "All three phases are delivered and internally consistent.",
      "The final output directly answers the original request.",
      "No placeholder or TODO content remains."
    ],
    subtasks: [
      {
        rangeLabel: "Phase 1: Research & Scoping",
        objective: `Gather the source material and define the scope needed to deliver: ${topic}. Produce a structured research brief that a second worker can execute against without repeating the research.`,
        contextNotes: "Prefer primary sources. Note explicitly where evidence is thin.",
        steps: [
          "Identify the key questions the master task implies.",
          "Collect and cite at least 5 credible sources.",
          "Summarise findings into a structured brief.",
          "Flag open questions and assumptions."
        ],
        acceptanceCriteria: [
          "Cites at least 5 distinct credible sources with URLs.",
          "Contains a scope section listing what is in and out of scope.",
          "Findings are organised under headed sections, not one block of prose.",
          "Lists at least 2 open questions or stated assumptions."
        ],
        deliverableFormat: "Markdown brief, 400-800 words, with a Sources section.",
        skills: ["research", "writing"],
        estimatedMinutes: 45,
        reward: share,
        leaseDuration: 3600
      },
      {
        rangeLabel: "Phase 2: Core Execution",
        objective: `Produce the main deliverable for: ${topic}. This is the substantive body of work - analysis, implementation, or content depending on the request.`,
        contextNotes: "",
        steps: [
          "Restate the deliverable's target shape before starting.",
          "Produce the core content or analysis.",
          "Support each claim with concrete evidence or reasoning.",
          "Self-review against the acceptance criteria before submitting."
        ],
        acceptanceCriteria: [
          "Deliverable directly fulfils the master task's core ask.",
          "At least 600 words, or the equivalent depth as a non-prose artifact.",
          "Every substantive claim is supported by evidence or explicit reasoning.",
          "No placeholders, TODOs, or truncated sections."
        ],
        deliverableFormat: "Markdown document with headed sections.",
        skills: ["analysis", "writing"],
        estimatedMinutes: 90,
        reward: share,
        leaseDuration: 7200
      },
      {
        rangeLabel: "Phase 3: QA Review & Summary",
        objective: `Validate the technical accuracy of the work on "${topic}", correct errors, and produce an executive summary suitable for a decision-maker.`,
        contextNotes: "Report problems found rather than silently fixing and hiding them.",
        steps: [
          "Check factual and numerical accuracy.",
          "Verify formatting and structural consistency.",
          "Write an executive summary.",
          "List issues found and their resolution."
        ],
        acceptanceCriteria: [
          "Includes an executive summary of 150-250 words.",
          "Lists every issue found with its severity and resolution.",
          "Explicitly confirms or disputes each factual claim checked.",
          "States a clear overall pass/fail recommendation with reasoning."
        ],
        deliverableFormat: "Markdown QA report with an Executive Summary section and an Issues table.",
        skills: ["qa", "editing"],
        estimatedMinutes: 40,
        reward: remainder > 0 ? remainder : share,
        leaseDuration: 3600
      }
    ]
  };
}

router.post("/", async (req, res) => {
  try {
    const parsed = DecomposeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const { descriptionCID, budget, aiModel } = parsed.data;

    console.log(`\n[Orchestrator] Decomposing task using model "${aiModel || "default"}"...`);
    const masterTaskText = await fetchFromIPFS(descriptionCID);
    if (!masterTaskText.trim()) {
      // Decomposing a CID string instead of the brief produces garbage subtasks,
      // so fail loudly rather than letting it through.
      return res.status(422).json({
        error: `Could not read the task description behind CID ${descriptionCID}. Re-submit the task so it is pinned again.`
      });
    }

    let parsedJson: any = null;

    try {
      const text = await generateWithGemini(buildPrompt(masterTaskText, budget), aiModel);
      const cleanJson = text.trim().replace(/```json/gi, "").replace(/```/g, "").trim();
      parsedJson = JSON.parse(cleanJson);
      if (!Array.isArray(parsedJson?.subtasks) || parsedJson.subtasks.length === 0) {
        throw new Error("Model returned no subtasks");
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
    const masterTaskCID = await pinToIPFS(masterMarkdown);
    await saveSpecDraft(masterTaskCID, "MASTER", {
      title: "Master Task",
      objective: masterObjective,
      contextNotes: masterContext,
      acceptanceCriteria: successCriteria,
      markdown: masterMarkdown
    });

    for (const spec of specs) {
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
    }

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
