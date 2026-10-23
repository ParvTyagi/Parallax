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
const answer = (text, extra = {}) => ({
  ok: true, json: async () => ({
    candidates: [{ finishReason: "STOP", content: { parts: [{ text }] }, ...extra }]
  })
});

test("verification uses Flash-Lite, v1beta, a key header and structured JSON", async () => {
  const calls = [];
  const api = loadTs("src/lib/gemini.ts", {
    fetch: async (url, init) => { calls.push({ url, init }); return answer('{"passed":true}'); }
  });
  await api.generateVerificationWithGemini("grade this");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent");
  assert.equal(calls[0].init.headers["x-goog-api-key"], "test-key");
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.generationConfig.responseMimeType, "application/json");
  assert.deepEqual(body.generationConfig.responseSchema.required, ["criteriaResults", "score", "passed", "reasons"]);
  assert.equal(body.contents[0].parts[0].text, "grade this");
});

test("404 retries the configured verification fallback once", async () => {
  const urls = [];
  const api = loadTs("src/lib/gemini.ts", {
    env: { GEMINI_VERIFY_MODEL: "models/gemini-custom", GEMINI_VERIFY_FALLBACK_MODEL: "gemini-backup" },
    fetch: async (url) => {
      urls.push(url);
      return urls.length === 1
        ? { ok: false, status: 404, json: async () => ({ error: { message: "not found" } }) }
        : answer("valid verdict");
    }
  });
  assert.equal(await api.generateVerificationWithGemini("grade"), "valid verdict");
  assert.ok(urls[0].endsWith("/gemini-custom:generateContent"));
  assert.ok(urls[1].endsWith("/gemini-backup:generateContent"));
});

test("failed requests throw instead of fabricating a verdict", async () => {
  let attempts = 0;
  const api = loadTs("src/lib/gemini.ts", {
    fetch: async () => { attempts++; throw new Error("provider unavailable"); }
  });
  await assert.rejects(api.generateVerificationWithGemini("grade"), /provider unavailable/);
  assert.equal(attempts, 2);
});

test("a timed out request is aborted and the fallback can finish", async () => {
  let attempts = 0;
  const api = loadTs("src/lib/gemini.ts", {
    fetch: async (_url, init) => {
      if (++attempts === 2) return answer("fallback result");
      return new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
    }
  });
  assert.equal(await api.generateWithGemini("grade", "primary", {
    fallbackModel: "backup", attemptTimeoutMs: 10, totalTimeoutMs: 1000
  }), "fallback result");
  assert.equal(attempts, 2);
});

test("ordinary generation keeps its own model and plain text output", async () => {
  const api = loadTs("src/lib/gemini.ts", {
    env: { GEMINI_MODEL: "gemini-project-model" },
    fetch: async (url, init) => {
      assert.ok(url.endsWith("/gemini-project-model:generateContent"));
      assert.equal(JSON.parse(init.body).generationConfig, undefined);
      return answer("report");
    }
  });
  assert.equal(await api.generateWithGemini("summarize"), "report");
});

test("truncated responses and thought-only output cannot become verdicts", async () => {
  for (const response of [
    answer("partial", { finishReason: "MAX_TOKENS" }),
    answer("", { content: { parts: [{ thought: true, text: "internal reasoning" }] } })
  ]) {
    const api = loadTs("src/lib/gemini.ts", { fetch: async () => response });
    await assert.rejects(api.generateVerificationWithGemini("grade"), /incomplete|empty/);
  }
});

function verifierFor(verdict) {
  return loadTs("src/lib/worker.ts", {
    require: (id) => {
      if (id === "./gemini") return {
        generateVerificationWithGemini: async () => JSON.stringify(verdict),
        generateWithGemini: () => { throw new Error("Verification used the general model"); }
      };
      return { config() {} };
    }
  }).runVerification;
}
const input = { requirement: "Return prime numbers", criteria: ["Exactly two numbers"], submission: "2, 3" };

test("worker uses the verification model and requires all recorded criteria", async () => {
  const valid = { passed: true, score: 100, reasons: ["Correct"], criteriaResults: [
    { criterion: input.criteria[0], met: true, note: "Two numbers supplied" }
  ] };
  assert.equal((await verifierFor(valid)(input)).passed, true);
  await assert.rejects(verifierFor({ ...valid, criteriaResults: [] })(input), /incomplete|criteria/i);
  assert.equal((await verifierFor({ ...valid, criteriaResults: [
    { criterion: input.criteria[0], met: false, note: "Missing a number" }
  ] })(input)).passed, false);
});
