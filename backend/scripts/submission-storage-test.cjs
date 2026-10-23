const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const ts = require("typescript");
const { ethers } = require("ethers");

const worker = "0x1111111111111111111111111111111111111111";
const otherWorker = "0x2222222222222222222222222222222222222222";
const cid = "QmTestSubmission";

function setup({ pinError, claimedBy = worker } = {}) {
  let handler;
  const pinned = [];
  const saved = [];
  const router = { post(_path, fn) { handler = fn; } };
  const dependencies = {
    express: { Router: () => router },
    "../db/client": { prisma: {
      subtask: { findFirst: async () => ({ worker: claimedBy }) },
      submission: { create: async ({ data }) => { saved.push(data); return { id: "submission-1", ...data }; } }
    } },
    "../lib/privateAccess": { requestWallet: req => req.header("x-parallax-wallet") || null },
    "../lib/deployments": { activeTaskFilter: () => ({ contractAddress: { equals: worker, mode: "insensitive" } }) },
    "../lib/ipfs": { pinToIPFS: async content => {
      if (pinError) throw pinError;
      pinned.push(content);
      return cid;
    } }
  };
  const filename = path.join(__dirname, "../src/routes/submissions.ts");
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports,
    require: name => {
      if (name.includes("privateSubmissions")) throw new Error("New submissions must not depend on Supabase storage");
      return dependencies[name] || require(name);
    },
    process: { env: {} },
    console: { error() {} }
  }, { filename });
  return {
    pinned, saved,
    async submit(body = { subtaskId: "subtask-1", worker, content: "My answer\nWith evidence." }, viewer = worker) {
      const response = { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; } };
      await handler({ body, header: () => viewer }, response);
      return response;
    }
  };
}

test("answers pin to IPFS without Supabase credentials and return the wallet's content proof", async () => {
  const app = setup();
  const content = "My answer\nWith evidence.";
  const response = await app.submit();
  assert.equal(response.statusCode, 200);
  assert.deepEqual(app.pinned, [content]);
  assert.equal(app.saved[0].storagePath, cid);
  assert.equal(app.saved[0].contentHash, "0x" + crypto.createHash("sha256").update(content).digest("hex"));
  assert.equal(response.body.submissionId, "submission-1");
  assert.equal(response.body.cid, cid);
  assert.equal(response.body.proofHash, ethers.id(content));
});

test("a failed upload does not record a successful submission", async () => {
  const app = setup({ pinError: new Error("Upload unavailable") });
  const response = await app.submit();
  assert.equal(response.statusCode, 500);
  assert.equal(app.saved.length, 0);
  assert.equal(response.body.success, undefined);
});

test("a different claimant or missing wallet header cannot upload an answer", async () => {
  for (const options of [{ claimedBy: otherWorker }, {}]) {
    const app = setup(options);
    const response = await app.submit(undefined, options.claimedBy ? worker : null);
    assert.equal(response.statusCode, 403);
    assert.equal(app.pinned.length, 0);
    assert.equal(app.saved.length, 0);
  }
});

test("invalid submission bodies are rejected before uploading", async () => {
  const app = setup();
  const response = await app.submit({ subtaskId: "subtask-1", worker });
  assert.equal(response.statusCode, 400);
  assert.equal(app.pinned.length, 0);
});
