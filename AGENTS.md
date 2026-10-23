# Agents

This document describes the role of the AI agents within the Parallax network.

Currently, Parallax uses a centralized "Orchestrator" built on the Gemini API to:
1. **Decompose:** Take a natural language task description and budget, and choose the smallest sufficient set of 1-5 independently workable subtasks based on workload and complexity. Simple requests remain one subtask; output item counts and description length do not force extra subtasks.
2. **Verify:** Once a worker submits a result, the AI agent verifies the content against the subtask definition.

If verified successfully, the Orchestrator (which holds a private key) executes an on-chain transaction to the `ParallaxTaskManager` to approve the work. Approval immediately pays the worker and returns their claim bond in the same transaction, setting the subtask to `VERIFIED`. New approvals have no dispute window. Failed verification preserves the submission, reward and bond in VERIFICATION_FAILED. Only the submitting worker can raise a dispute; the administrator either pays the worker and returns the bond or upholds rejection, refunds the creator and slashes the bond. The app indexes, displays and processes only the active immediate-payout deployment. Older contracts and their escrow remain on-chain, but their projects and pending jobs are excluded from the app.
