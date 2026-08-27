import { Router } from "express";
import { getGeminiModel } from "../lib/gemini";
import { fetchFromIPFS, pinToIPFS } from "../lib/ipfs";
import crypto from "crypto";
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
    
    // Use the user-selected model (falls back to default if non-Gemini or unset)
    const model = getGeminiModel(aiModel);
    console.log(`\n[Orchestrator] Using model "${aiModel || 'default'}" for task decomposition...`);

    const masterTaskText = await fetchFromIPFS(descriptionCID);

    const prompt = `
You are an AI task orchestrator for a microtasking platform.
The user wants to accomplish the following master task: "${masterTaskText}"
The total budget for this task is: ${budget} MON.

Your job is to break this master task into exactly 3 to 5 independent subtasks.
Each subtask must be able to be completed independently by a different worker.
The total reward of all subtasks must not exceed the total budget. (It is fine to leave a small buffer).
Also, assign a realistic leaseDuration (in seconds) for each subtask based on how complex it is. Give them at least 120 seconds (2 mins) for simple tasks, up to 1800 seconds (30 mins) for hard tasks.

Return ONLY valid JSON with no markdown wrapping and no backticks. The JSON must exactly match this structure:
{
  "masterTask": "string",
  "subtasks": [
    { "rangeLabel": "string", "description": "string", "reward": number, "leaseDuration": number }
  ]
}
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim().replace(/```json/g, "").replace(/```/g, "");
    
    let parsedJson;
    try {
      parsedJson = JSON.parse(text);
    } catch (e) {
      console.error("AI returned invalid JSON:", text);
      return res.status(500).json({ error: "AI failed to generate valid JSON structure." });
    }

    // Validate the parsed output
    if (!parsedJson.masterTask || !Array.isArray(parsedJson.subtasks) || parsedJson.subtasks.length < 3 || parsedJson.subtasks.length > 5) {
      return res.status(500).json({ error: "AI decomposition failed validation checks." });
    }

    // Convert descriptions to CIDs before returning to frontend
    parsedJson.masterTaskCID = await pinToIPFS(parsedJson.masterTask);
    
    // Process subtasks sequentially to avoid rate limits or nonce issues
    for (const st of parsedJson.subtasks) {
      st.descriptionCID = await pinToIPFS(st.description);
    }

    res.json(parsedJson);
  } catch (error) {
    console.error("Error in decompose:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
