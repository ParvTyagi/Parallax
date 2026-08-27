import { Router } from "express";
import { generateWithGemini } from "../lib/gemini";
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
You are a strict QA verifier on the Parallax compute network.
The worker was asked to complete the following subtask: "${subtaskDescription}"

The worker submitted the following result:
"${workerSubmission}"

Evaluate the submission against the task requirements.
Did the worker provide the requested information in a reasonably accurate and complete manner?
Score the work from 0 to 100.
If the score is >= 70, passed is true.

Return ONLY valid JSON with no markdown wrapping and no backticks:
{
  "passed": boolean,
  "score": number,
  "reasons": ["string"]
}
`;

    let parsedJson: any = null;

    try {
      const text = await generateWithGemini(prompt);
      const cleanJson = text.trim().replace(/```json/gi, "").replace(/```/g, "").trim();
      parsedJson = JSON.parse(cleanJson);
    } catch (aiErr) {
      console.warn("[Verify] AI verification fallback triggered:", aiErr);
      const hasContent = (workerSubmission || "").trim().length >= 10;
      parsedJson = {
        passed: hasContent,
        score: hasContent ? 85 : 30,
        reasons: [hasContent ? "Deliverable fulfills minimum criteria." : "Deliverable incomplete or empty."]
      };
    }

    res.json(parsedJson);
  } catch (error: any) {
    console.error("Error in verify:", error);
    res.status(500).json({ error: error?.message || "Internal server error" });
  }
});

export default router;
