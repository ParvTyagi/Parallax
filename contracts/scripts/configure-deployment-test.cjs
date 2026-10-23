const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function fixture() {
  const root = path.resolve(__dirname, "../..");
  const files = new Map();
  for (const name of ["frontend/src/lib/constants.ts", "contracts/artifacts/contracts/ParallaxTaskManager.sol/ParallaxTaskManager.json"]) {
    files.set(path.join(root, name), fs.readFileSync(path.join(root, name), "utf8"));
  }
  files.set(path.join(root, "backend/.env"), "ETH_RPC_URL=https://old-rpc.example\nCHAIN_START_BLOCK=11967798\nGEMINI_API_KEY=keep-me\n");
  files.set(path.join(root, "frontend/.env"), "VITE_ETH_CHAIN_ID=0xaa36a7\nVITE_API_URL=https://my-api.example\n");
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "configure-deployment.cjs"), "utf8"), {
    module, __dirname, console: { log() {} },
    require: (name) => name === "node:fs" ? {
      existsSync: (file) => files.has(file), readFileSync: (file) => files.get(file),
      writeFileSync: (file, content) => files.set(file, content),
    } : require(name),
  });
  return { files, root, configure: module.exports.configureDeployment };
}

const record = { chainId: 10143, state: "verified", startBlock: 4321,
  taskManagerAddress: "0x1111111111111111111111111111111111111111",
  escrowAddress: "0x2222222222222222222222222222222222222222" };

test("activation replaces stale Sepolia settings and start block while preserving unrelated secrets and API settings", () => {
  const { files, root, configure } = fixture();
  configure(record, root);
  const env = files.get(path.join(root, "backend/.env"));
  assert.match(env, /CHAIN_START_BLOCK=4321/);
  assert.match(env, /MONAD_RPC_URL=https:\/\/testnet-rpc.monad.xyz/);
  assert.match(env, /ETH_RPC_URL=https:\/\/testnet-rpc.monad.xyz/);
  assert.match(env, /GEMINI_API_KEY=keep-me/);
  const frontend = files.get(path.join(root, "frontend/.env"));
  assert.match(frontend, /VITE_ETH_CHAIN_ID=0x279f/);
  assert.match(frontend, /VITE_MONAD_CHAIN_ID=0x279f/);
  assert.match(frontend, /VITE_API_URL=https:\/\/my-api.example/);
  assert.match(files.get(path.join(root, "frontend/src/lib/constants.ts")), new RegExp(record.taskManagerAddress));
  assert.deepEqual(JSON.parse(files.get(path.join(root, "contracts/deployment.json"))), record);
});

test("unverified deployments cannot change any configuration", () => {
  const { files, root, configure } = fixture();
  const before = [...files.entries()];
  assert.throws(() => configure({ ...record, state: "submitted" }, root), /verified deployment/);
  assert.deepEqual([...files.entries()], before);
});
