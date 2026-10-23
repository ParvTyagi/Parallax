const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const ts = require("typescript");

function loadTs(relativePath, overrides) {
  const filename = path.join(__dirname, "..", relativePath);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, require: () => ({ config() {} }),
    process: { env: { GEMINI_API_KEY: "test-key", ...overrides.env } },
    console: { log() {}, warn() {}, error() {} },
    performance, setTimeout, clearTimeout, AbortController,
    ...overrides
  }, { filename });
  return module.exports;
}

function indexer() {
  const updates = [];
  const prisma = {
    subtask: { updateMany: async (query) => { updates.push(query); } },
    task: {
      updateMany: async () => {},
      findUnique: async () => ({ status: "COMPLETED", subtasks: [{ state: "VERIFIED" }] })
    }
  };
  const api = loadTs("src/lib/chain.ts", {
    require: (id) => id === "../db/client" ? { prisma } : { config() {} }
  });
  return { ...api, updates };
}
test("failed verification keeps the worker, bond and submission for appeal", async () => {
  const { applyEvent, updates } = indexer();
  await applyEvent("SubtaskVerificationFailed", ["task", "subtask", 35]);
  assert.equal(updates[0].data.state, "VERIFICATION_FAILED");
  assert.equal(updates[0].data.qualityScore, 35);
  for (const field of ["worker", "bondAmount", "submissionHash"]) {
    assert.equal(Object.hasOwn(updates[0].data, field), false);
  }
});
test("worker appeals enter the administrator dispute queue", async () => {
  const { applyEvent, updates } = indexer();
  await applyEvent("DisputeRaised", ["task", "subtask", "worker"]);
  assert.equal(updates[0].data.state, "IN_DISPUTE");
});

test("successful verification is immediately verified without a payout deadline", async () => {
  const { applyEvent, updates } = indexer();
  await applyEvent("SubtaskVerified", ["task", "subtask", true, 95, 0]);
  assert.equal(updates[0].data.state, "VERIFIED");
  assert.equal(updates[0].data.disputeDeadline, null);
});

test("a delayed payout event cannot be mislabeled as paid", async () => {
  const { applyEvent, updates } = indexer();
  await assert.rejects(applyEvent("SubtaskVerified", ["task", "subtask", true, 95, 172800]), /Delayed payouts/);
  assert.equal(updates.length, 0);
});
test("admin approval records its payment transaction; rejection retains worker history", async () => {
  for (const workerWins of [true, false]) {
    const { applyEvent, updates } = indexer();
    await applyEvent("DisputeResolved", ["task", "subtask", workerWins], { transactionHash: "0xresolved" });
    assert.equal(updates[0].data.state, workerWins ? "VERIFIED" : "REJECTED");
    assert.equal(updates[0].data.payoutTxHash, workerWins ? "0xresolved" : undefined);
    assert.equal(updates[0].data.bondAmount, null);
    assert.equal(Object.hasOwn(updates[0].data, "worker"), false);
  }
});
