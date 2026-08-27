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
  // Only allow Gemini models — non-Gemini model names fall back to default
  const isGeminiModel = !modelName || modelName.startsWith("gemini-");
  const resolvedModel = isGeminiModel ? (modelName || DEFAULT_MODEL) : DEFAULT_MODEL;
  console.log(`[Gemini] Resolving model: requested="${modelName}" → using="${resolvedModel}"`);
  return genAI.getGenerativeModel({ model: resolvedModel });
}
