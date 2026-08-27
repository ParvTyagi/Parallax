import { Router } from "express";
import { generateWithGemini } from "../lib/gemini";
import { fetchFromIPFS, pinToIPFS } from "../lib/ipfs";
import { z } from "zod";

const router = Router();

const DecomposeRequestSchema = z.object({
  descriptionCID: z.string(),
  budget: z.string(),
  aiModel: z.string().optional()
});

router.post("/", async (req, res) => {
  try {
    const parsed = DecomposeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const { descriptionCID, budget, aiModel } = parsed.data;
    
    console.log(`\n[Orchestrator] Decomposing task using model "${aiModel || 'default'}"...`);
    const masterTaskText = await fetchFromIPFS(descriptionCID);

    const prompt = `
You are an AI task orchestrator for a decentralized microtasking platform on Monad.
The user wants to accomplish the following master task: "${masterTaskText}"
The total budget for this task is: ${budget} MON.

Your job is to break this master task into exactly 3 to 5 independent subtasks.
Each subtask must be able to be completed independently by a different worker.
The total reward of all subtasks must not exceed the total budget.
Also, assign a realistic leaseDuration (in seconds) for each subtask based on complexity (e.g. 300 to 1800 seconds).

Return ONLY valid JSON with no markdown wrapping and no backticks:
{
  "masterTask": "string",
  "subtasks": [
    { "rangeLabel": "string", "description": "string", "reward": number, "leaseDuration": number }
  ]
}
`;

    let parsedJson: any = null;

    try {
      const text = await generateWithGemini(prompt, aiModel);
      const cleanJson = text.trim().replace(/```json/gi, "").replace(/```/g, "").trim();
      parsedJson = JSON.parse(cleanJson);
    } catch (aiErr) {
      console.warn("[Decompose] Gemini AI decomposition fallback triggered:", aiErr);
      
      const numBudget = parseFloat(budget) || 10;
      const subtaskBudget = parseFloat((numBudget / 3).toFixed(2));
      const remainder = parseFloat((numBudget - (subtaskBudget * 2)).toFixed(2));

      parsedJson = {
        masterTask: masterTaskText || "Master Task Specification",
        subtasks: [
          {
            rangeLabel: "Phase 1: Research & Discovery",
            description: `Gather requirements, research domain context, and scope deliverables for: ${masterTaskText.slice(0, 120)}`,
            reward: subtaskBudget,
            leaseDuration: 900
          },
          {
            rangeLabel: "Phase 2: Execution & Implementation",
            description: `Execute core deliverable, analyze findings, and synthesize output for: ${masterTaskText.slice(0, 120)}`,
            reward: subtaskBudget,
            leaseDuration: 1800
          },
          {
            rangeLabel: "Phase 3: QA Review & Validation",
            description: `Verify technical accuracy, format results, and produce executive summary for: ${masterTaskText.slice(0, 120)}`,
            reward: remainder > 0 ? remainder : subtaskBudget,
            leaseDuration: 900
          }
        ]
      };
    }

    // Ensure subtasks exist and have valid structure
    if (!parsedJson || !Array.isArray(parsedJson.subtasks) || parsedJson.subtasks.length === 0) {
      return res.status(500).json({ error: "Failed to generate valid subtask breakdown." });
    }

    // Convert descriptions to CIDs
    parsedJson.masterTaskCID = await pinToIPFS(parsedJson.masterTask || masterTaskText);
    
    for (const st of parsedJson.subtasks) {
      st.descriptionCID = await pinToIPFS(st.description);
    }

    res.json(parsedJson);
  } catch (error: any) {
    console.error("Error in decompose:", error);
    res.status(500).json({ error: error?.message || "Internal server error" });
  }
});

export default router;
