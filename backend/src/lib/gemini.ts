import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const DEFAULT_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash";

export interface GenerationOptions {
  attemptTimeoutMs?: number;
  totalTimeoutMs?: number;
  fallbackModel?: string;
  responseSchema?: Record<string, unknown>;
}

// Use REST explicitly: the installed legacy SDK hard-codes v1 and ignores apiVersion.
export async function generateWithGemini(
  prompt: string,
  requestedModel?: string,
  options: GenerationOptions = {}
): Promise<string> {
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");

  const models = Array.from(new Set([
    requestedModel || DEFAULT_MODEL,
    options.fallbackModel || DEFAULT_FALLBACK_MODEL
  ].map((model) => model.replace(/^models\//, ""))));
  const attemptTimeoutMs = options.attemptTimeoutMs ?? 60000;
  const deadline = performance.now() + (options.totalTimeoutMs ?? 90000);
  let lastError: unknown = null;

  for (const model of models) {
    const remainingMs = Math.floor(deadline - performance.now());
    if (remainingMs <= 0) break;
    const startedAt = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(attemptTimeoutMs, remainingMs));
    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            ...(options.responseSchema ? {
              generationConfig: {
                responseMimeType: "application/json",
                responseSchema: options.responseSchema
              }
            } : {})
          })
        }
      );
      const data = await response.json() as any;
      if (!response.ok) {
        throw new Error("Gemini HTTP " + response.status + " for " + model + ": " +
          (data.error?.message || response.statusText));
      }
      const candidate = data.candidates?.[0];
      if (candidate?.finishReason && candidate.finishReason !== "STOP") {
        throw new Error("Gemini returned an incomplete response: " + candidate.finishReason);
      }
      const text = (candidate?.content?.parts || [])
        .filter((part: any) => !part.thought && typeof part.text === "string")
        .map((part: any) => part.text).join("");
      if (!text.trim()) throw new Error("Model returned an empty or blocked response");
      return text;
    } catch (error: any) {
      lastError = controller.signal.aborted
        ? new Error("Gemini request timed out for " + model)
        : error;
      console.warn("[Gemini] Generation failed on model " + model + ":", (lastError as Error).message);
    } finally {
      clearTimeout(timeout);
      console.log("[Gemini] Model " + model + " finished in " + Math.round(performance.now() - startedAt) + "ms");
    }
  }

  throw lastError || new Error("Gemini generation deadline exceeded");
}

const VERIFICATION_SCHEMA = {
  type: "OBJECT",
  properties: {
    criteriaResults: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          criterion: { type: "STRING" },
          met: { type: "BOOLEAN" },
          note: { type: "STRING" }
        },
        required: ["criterion", "met", "note"]
      }
    },
    score: { type: "INTEGER" },
    passed: { type: "BOOLEAN" },
    reasons: { type: "ARRAY", items: { type: "STRING" } }
  },
  required: ["criteriaResults", "score", "passed", "reasons"]
};

// Keep verification fast and independent of the decomposition/aggregation model.
export function generateVerificationWithGemini(prompt: string): Promise<string> {
  return generateWithGemini(prompt, process.env.GEMINI_VERIFY_MODEL || "gemini-3.1-flash-lite", {
    fallbackModel: process.env.GEMINI_VERIFY_FALLBACK_MODEL || "gemini-2.5-flash",
    attemptTimeoutMs: 20000,
    totalTimeoutMs: 40000,
    responseSchema: VERIFICATION_SCHEMA
  });
}
