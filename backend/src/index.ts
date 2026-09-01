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
import tasksRouter, { workersRouter } from "./routes/tasks";
import ipfsRouter from "./routes/ipfs";
import { hasPinataCredentials } from "./lib/ipfs";
import { startJobWorker } from "./lib/worker";
import rateLimit from "express-rate-limit";

// Limits are split by cost. A single bucket across all of /api cannot work:
// the dashboard alone polls every 5s, which is 180 requests per window.
const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." }
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." }
});

// Every call here costs Gemini tokens.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "AI request limit reached. Please wait a few minutes." }
});

// Uploads are buffered in memory before pinning, so cap how fast they arrive.
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Upload limit reached. Please wait a few minutes." }
});

app.use("/api/", (req, res, next) =>
  req.method === "GET" ? readLimiter(req, res, next) : writeLimiter(req, res, next)
);

app.get("/health", (req, res) => {
  // `ipfsPinning` is the one that silently breaks things: without Pinata
  // credentials every pin falls back to a locally generated CID that no gateway
  // can resolve, so task descriptions come back empty on the next deploy.
  res.json({
    status: "ok",
    message: "Parallax Backend is running securely",
    ipfsPinning: hasPinataCredentials() ? "pinata" : "local-fallback"
  });
});

app.use("/api/decompose", aiLimiter, decomposeRouter);
app.use("/api/verify", aiLimiter, verifyRouter);
app.use("/api/submissions", submissionsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/workers", workersRouter);
// Only the write paths are throttled here; GET /file/:cid and /archive/... fall
// through to the read limiter so browsing an archive's entries stays usable.
app.use("/api/ipfs", (req, res, next) =>
  req.method === "POST" ? uploadLimiter(req, res, next) : next()
);
app.use("/api/ipfs", ipfsRouter);

setupChainListeners().catch(console.error);
startJobWorker().catch(console.error);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
