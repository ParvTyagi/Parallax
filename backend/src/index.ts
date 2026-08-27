import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { setupChainListeners } from "./lib/chain";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

import decomposeRouter from "./routes/decompose";
import verifyRouter from "./routes/verify";
import submissionsRouter from "./routes/submissions";
import tasksRouter from "./routes/tasks";
import ipfsRouter from "./routes/ipfs";
import { startJobWorker } from "./lib/worker";
import rateLimit from "express-rate-limit";

// Rate limiting setup (Phase 1 Security)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window`
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." }
});

// Apply rate limiter to all /api routes
app.use("/api/", apiLimiter);

// Basic health endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Parallax Backend is running securely" });
});

// API Routes
app.use("/api/decompose", decomposeRouter);
app.use("/api/verify", verifyRouter);
app.use("/api/submissions", submissionsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/workers", tasksRouter);
app.use("/api/ipfs", ipfsRouter);

// Setup background services
setupChainListeners().catch(console.error);
startJobWorker().catch(console.error);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
