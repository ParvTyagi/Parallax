import { Router } from "express";
import { geminiModel } from "../lib/gemini";
import { z } from "zod";

const router = Router();

const VerifyRequestSchema = z.object({
  subtaskDescription: z.string(),
  workerSubmission: z.string()
});

router.post("/", async (req, res) => {
  try {
    const parsed = VerifyRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const { subtaskDescription, workerSubmission } = parsed.data;

    const prompt = `
You are an strict QA verifier.
The worker was asked to complete the following subtask: "${subtaskDescription}"

The worker submitted the following result:
"${workerSubmission}"

Evaluate the submission against the task requirements.
Did the worker provide the requested information in a reasonably accurate and complete manner?
Score the work from 0 to 100.
If the score is >= 70, passed is true.

Return ONLY valid JSON with no markdown wrapping and no backticks. The JSON must exactly match this structure:
{
  "passed": boolean,
  "score": number,
  "reasons": ["string"]
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

    res.json(parsedJson);
  } catch (error) {
    console.error("Error in verify:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
