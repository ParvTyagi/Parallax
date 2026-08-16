# Agents

This document describes the role of the AI agents within the Parallax network.

Currently, Parallax uses a centralized "Orchestrator" built on the Gemini API to:
1. **Decompose:** Take a large natural language task description and budget, and split it into 3-5 independently workable subtasks.
2. **Verify:** Once a worker submits a result, the AI agent verifies the content against the subtask definition.

If verified successfully, the Orchestrator (which holds a private key) will execute an on-chain transaction to the `ParallaxTaskManager` to approve the work and trigger immediate release of Monad tokens to the worker.
