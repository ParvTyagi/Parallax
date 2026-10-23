const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const active = "0x1111111111111111111111111111111111111111";

function setup() {
  const routers = [];
  const queries = [];
  const find = (model, result) => async query => {
    queries.push({ model, query });
    const filter = model === "subtask" ? query.where.task : query.where;
    assert.equal(filter.contractAddress.equals, active);
    assert.equal(filter.contractAddress.mode, "insensitive");
    return result;
  };
  const dependencies = {
    express: { Router() {
      const handlers = new Map();
      const router = { get(paths, fn) { for (const p of [].concat(paths)) handlers.set(p, fn); }, post() {}, handlers };
      routers.push(router);
      return router;
    } },
    "../db/client": { prisma: {
      task: { findMany: find("task", []), findFirst: find("task", null) },
      subtask: { findMany: find("subtask", []) },
      workerProfile: { findFirst: async () => null }
    } },
    "../lib/chain": { isTaskManagerAdmin: async () => true },
    "../lib/privateAccess": { requestWallet: () => active },
    "../lib/deployments": { activeTaskFilter: () => ({ contractAddress: { equals: active, mode: "insensitive" } }) },
    "../lib/ipfs": {},
    "../lib/privateSubmissions": {}
  };
  const filename = path.join(__dirname, "../src/routes/tasks.ts");
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, require: name => dependencies[name] || require(name),
    console: { error() {} }
  }, { filename });
  return { routers, queries };
}

for (const [routerIndex, route] of [[0, "/subtasks/open"], [0, "/customer/:address"], [0, "/worker/:address"], [0, "/disputes/open"], [1, "/:address"], [0, "/:taskId"]]) {
  test(`${routerIndex === 1 ? "worker profile" : "tasks"} ${route} excludes other contracts at the database query`, async () => {
    const { routers, queries } = setup();
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await routers[routerIndex].handlers.get(route)({ params: { address: active, taskId: "old-project" } }, res);
    assert.equal(queries.length, 1);
    assert.equal(res.code, route === "/:taskId" ? 404 : 200);
  });
}
