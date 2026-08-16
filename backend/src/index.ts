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
import orchestratorRouter from "./routes/orchestrator";
import tasksRouter from "./routes/tasks";

// Basic health endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Parallax Backend is running" });
});

// API Routes
app.use("/api/decompose", decomposeRouter);
app.use("/api/verify", verifyRouter);
app.use("/api/submissions", submissionsRouter);
app.use("/api/orchestrator", orchestratorRouter);
app.use("/api/tasks", tasksRouter);

// Setup chain listeners on startup
setupChainListeners().catch(console.error);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
