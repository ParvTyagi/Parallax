import { Router } from "express";
import { geminiModel } from "../lib/gemini";
import { z } from "zod";

const router = Router();

const DecomposeRequestSchema = z.object({
  description: z.string(),
  budget: z.string()
});

router.post("/", async (req, res) => {
  try {
    const parsed = DecomposeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const { description, budget } = parsed.data;

    const prompt = `
You are an AI task orchestrator for a microtasking platform.
The user wants to accomplish the following master task: "${description}"
The total budget for this task is: ${budget} MON.

Your job is to break this master task into exactly 3 to 5 independent subtasks.
Each subtask must be able to be completed independently by a different worker.
The total reward of all subtasks must not exceed the total budget. (It is fine to leave a small buffer).

Return ONLY valid JSON with no markdown wrapping and no backticks. The JSON must exactly match this structure:
{
  "masterTask": "string",
  "subtasks": [
    { "rangeLabel": "string", "description": "string", "reward": number }
  ]
}
`;

    const result = await geminiModel.generateContent(prompt);
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

    res.json(parsedJson);
  } catch (error) {
    console.error("Error in decompose:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
