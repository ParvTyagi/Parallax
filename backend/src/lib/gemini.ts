import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set in environment variables.");
}

const genAI = new GoogleGenerativeAI(apiKey || "");
const modelName = process.env.GEMINI_MODEL || "gemini-1.5-pro";
export const geminiModel = genAI.getGenerativeModel({ model: modelName }); // We use pro for more reliable structured output

// Note: For the hackathon MVP demo, we will use structured JSON prompting.
