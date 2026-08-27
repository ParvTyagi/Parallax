import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set in environment variables.");
}

const genAI = new GoogleGenerativeAI(apiKey || "");

// Default model - updated to latest Gemini 3.7 Flash
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.7-flash";

// Singleton for the default model (used by verify route which doesn't get a user model)
export const geminiModel = genAI.getGenerativeModel({ model: DEFAULT_MODEL });

// Factory function - allows decompose route to use the user's chosen model
export function getGeminiModel(modelName?: string) {
  const isGeminiModel = !modelName || modelName.startsWith("gemini-");
  const resolvedModel = isGeminiModel ? (modelName || DEFAULT_MODEL) : DEFAULT_MODEL;
  console.log(`[Gemini] Resolving model: requested="${modelName}" → using="${resolvedModel}"`);
  return genAI.getGenerativeModel({ model: resolvedModel });
}

// Resilient text generation with automatic model fallback
export async function generateWithGemini(prompt: string, requestedModel?: string): Promise<string> {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const candidateModels = [
    requestedModel,
    process.env.GEMINI_MODEL,
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro"
  ].filter(Boolean) as string[];

  const uniqueModels = Array.from(new Set(candidateModels));
  let lastError: any = null;

  for (const model of uniqueModels) {
    try {
      const genModel = genAI.getGenerativeModel({ model });
      const result = await genModel.generateContent(prompt);
      const text = result.response.text();
      if (text) {
        return text;
      }
    } catch (err: any) {
      console.warn(`[Gemini] Generation failed on model ${model}:`, err?.message || err);
      lastError = err;
    }
  }

  throw lastError || new Error("Failed to generate content with Gemini API");
}
