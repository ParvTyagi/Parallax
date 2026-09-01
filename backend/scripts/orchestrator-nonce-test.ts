/// Verifies the orchestrator transaction queue against a stub JSON-RPC node.
///
/// Exercises the real production path (ethers signing included) rather than a
/// mock, and asserts that concurrent sends are serialised onto strictly
/// increasing nonces, and that a failure resyncs rather than skipping a nonce.
import http from "http";
import { ethers } from "ethers";

const CHAIN_ID = 10143;
let chainNonce = 7; // Pretend the key has already sent 7 transactions.
const sentNonces: number[] = [];
let maxInFlight = 0;
let inFlight = 0;
let failNext = false;

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const reqs = JSON.parse(body);
    const list = Array.isArray(reqs) ? reqs : [reqs];
    const out = list.map((r: any) => {
      try {
        return { jsonrpc: "2.0", id: r.id, result: handle(r) };
      } catch (e: any) {
        return { jsonrpc: "2.0", id: r.id, error: { code: -32000, message: e.message } };
      }
    });
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(Array.isArray(reqs) ? out : out[0]));
  });
});

function handle(r: any): any {
  switch (r.method) {
    case "eth_chainId": return "0x" + CHAIN_ID.toString(16);
    case "net_version": return String(CHAIN_ID);
    case "eth_blockNumber": return "0x10";
    case "eth_getBlockByNumber":
      return { number: "0x10", hash: "0x" + "11".repeat(32), parentHash: "0x" + "22".repeat(32),
               timestamp: "0x1", gasLimit: "0x1c9c380", gasUsed: "0x0", baseFeePerGas: "0x7", miner:
               "0x" + "00".repeat(20), extraData: "0x", transactions: [], difficulty: "0x0",
               nonce: "0x0000000000000000", sha3Uncles: "0x" + "33".repeat(32), stateRoot:
               "0x" + "44".repeat(32), receiptsRoot: "0x" + "55".repeat(32), transactionsRoot:
               "0x" + "66".repeat(32), logsBloom: "0x" + "00".repeat(256), size: "0x1",
               totalDifficulty: "0x0", uncles: [] };
    case "eth_maxPriorityFeePerGas": return "0x1";
    case "eth_gasPrice": return "0x10";
    case "eth_estimateGas": return "0x5208";
    case "eth_getTransactionCount": return "0x" + chainNonce.toString(16);
    case "eth_sendRawTransaction": {
      const tx = ethers.Transaction.from(r.params[0]);
      if (failNext) { failNext = false; throw new Error("simulated"); }
      sentNonces.push(tx.nonce);
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      chainNonce = Math.max(chainNonce, tx.nonce + 1);
      return tx.hash;
    }
    case "eth_getTransactionReceipt": {
      inFlight = Math.max(0, inFlight - 1);
      return { transactionHash: r.params[0], blockNumber: "0x10", blockHash: "0x" + "11".repeat(32),
               status: "0x1", gasUsed: "0x5208", cumulativeGasUsed: "0x5208", logs: [], logsBloom:
               "0x" + "00".repeat(256), type: "0x2", from: "0x" + "00".repeat(20), to: "0x" + "01".repeat(20),
               contractAddress: null, index: 0, transactionIndex: "0x0", effectiveGasPrice: "0x10" };
    }
    default: return null;
  }
}

(async () => {
  await new Promise<void>((r) => server.listen(4600, r));

  process.env.MONAD_RPC_URL = "http://127.0.0.1:4600";
  process.env.ORCHESTRATOR_PRIVATE_KEY = "0x" + "11".repeat(32);
  process.env.TASKMANAGER_ADDRESS = "0x" + "01".repeat(20);

  const { sendOrchestratorTx } = await import("../src/lib/orchestrator");

  const taskId = "0x" + "aa".repeat(32);
  const subtaskId = "0x" + "bb".repeat(32);

  // Fire five concurrently. A correct queue serialises them onto 7,8,9,10,11.
  const results = await Promise.allSettled(
    [0, 1, 2, 3, 4].map((i) =>
      sendOrchestratorTx(`verify-${i}`, (c, o) =>
        c.verifySubtask(taskId, subtaskId, true, 90, o)
      )
    )
  );

  console.log("settled:", results.map((r) => r.status).join(","));
  console.log("nonces used:", sentNonces.join(","));
  console.log("strictly increasing, no gaps:",
    sentNonces.every((n, i) => i === 0 || n === sentNonces[i - 1] + 1));
  console.log("max concurrent in-flight:", maxInFlight, "(must be 1)");

  // A failure must resync rather than burn a nonce.
  const before = sentNonces.length;
  failNext = true;
  const bad = await sendOrchestratorTx("will-fail", (c, o) =>
    c.verifySubtask(taskId, subtaskId, true, 90, o)
  ).then(() => "resolved").catch(() => "rejected");
  const after = await sendOrchestratorTx("after-fail", (c, o) =>
    c.verifySubtask(taskId, subtaskId, true, 90, o)
  ).then(() => "resolved").catch((e) => "rejected: " + e.message);

  console.log("failing tx:", bad, "| next tx after failure:", after);
  console.log("nonces after recovery:", sentNonces.slice(before).join(","));

  server.close();
})();
