const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const current = "0x1111111111111111111111111111111111111111";
const previous = "0x2222222222222222222222222222222222222222";
function load(extraEnv = {}) {
  const filename = path.join(__dirname, "../src/lib/deployments.ts");
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, require,
    process: { env: {
      TASKMANAGER_ADDRESS: current,
      CHAIN_START_BLOCK: "200",
      LEGACY_DEPLOYMENTS: JSON.stringify([{ taskManagerAddress: previous, startBlock: 100 }]),
      LEGACY_DEFAULT_TASKMANAGER_ADDRESS: previous,
      ...extraEnv
    } }
  }, { filename });
  return module.exports;
}

test("only the active contract is indexed even when stale legacy settings remain", () => {
  const api = load();
  assert.equal(api.getDeployment().taskManagerAddress, current);
  assert.equal(api.getTaskDeployment(current).taskManagerAddress, current);
  assert.throws(() => api.getTaskDeployment(previous), /not a configured deployment/);
  assert.throws(() => api.getDeployment(previous), /not a configured deployment/);
  assert.equal(api.getDeployments().length, 1);
  assert.equal(api.activeTaskFilter().contractAddress.equals, current);
  assert.equal(api.activeTaskFilter().contractAddress.mode, "insensitive");
});

test("historical tasks without a contract address cannot use active escrow", () => {
  const api = load();
  assert.throws(() => api.getTaskDeployment(null), /no active contract/);
  assert.throws(() => api.getTaskDeployment(undefined), /no active contract/);
});

test("an invalid active address is rejected", () => {
  assert.throws(() => load({ TASKMANAGER_ADDRESS: "invalid" }).getDeployment(), /Invalid configured/);
});
