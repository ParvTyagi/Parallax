# Agents

This document describes the role of the AI agents within the Parallax network.

Currently, Parallax uses a centralized "Orchestrator" built on the Gemini API to:
1. **Decompose:** Take a large natural language task description and budget, and split it into 3-5 independently workable subtasks.
2. **Verify:** Once a worker submits a result, the AI agent verifies the content against the subtask definition.

If verified successfully, the Orchestrator (which holds a private key) executes an on-chain transaction to the `ParallaxTaskManager` to approve the work. This does **not** release funds immediately: it starts a 48-hour dispute window (`PENDING_RELEASE`) during which the task creator can call `disputeTask()` to challenge the result. If undisputed, a backend sweep (or anyone) calls `releasePayout()` once the window elapses, paying the worker and returning their claim bond. A raised dispute is settled by the protocol admin via `resolveDispute()`.
