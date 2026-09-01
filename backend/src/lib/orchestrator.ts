import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const TASK_MANAGER_ABI = [
  "function verifySubtask(bytes32 taskId, bytes32 subtaskId, bool passed, uint8 score) external",
  "function releasePayout(bytes32 taskId, bytes32 subtaskId) external"
];

/// How long to wait for a submitted transaction to mine before giving up on it.
/// Without a bound, one stalled transaction would block the orchestrator queue
/// forever and no payout would ever be released again.
const TX_TIMEOUT_MS = Number(process.env.ORCHESTRATOR_TX_TIMEOUT_MS || 120000);

let wallet: ethers.Wallet | null = null;
let contract: ethers.Contract | null = null;

export function getOrchestratorContract(): ethers.Contract {
  if (contract) return contract;

  const rpcUrl = process.env.MONAD_RPC_URL;
  const pk = process.env.ORCHESTRATOR_PRIVATE_KEY;
  const taskManagerAddress = process.env.TASKMANAGER_ADDRESS;

  if (!rpcUrl || !pk || !taskManagerAddress) {
    throw new Error("Missing orchestrator credentials");
  }

  const formattedPk = pk.startsWith("0x") ? pk : `0x${pk}`;
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  wallet = new ethers.Wallet(formattedPk, provider);
  contract = new ethers.Contract(taskManagerAddress, TASK_MANAGER_ABI, wallet);
  return contract;
}

/// Serialises every transaction sent from the orchestrator key.
///
/// The verify job worker and the payout sweeper run on independent timers and
/// both sign with the same key. Previously each built its own transaction and
/// let ethers pick the nonce, so two overlapping sends would fetch the same
/// pending nonce — one replaces the other, and a payout silently never happens.
/// One key means one in-flight transaction at a time.
let queue: Promise<unknown> = Promise.resolve();

/// Locally tracked next nonce. Reset to null after any failure so the next send
/// resyncs from the chain rather than building on a nonce that may not have landed.
let nextNonce: number | null = null;

export interface TxOverrides {
  nonce: number;
}

/// Queues one orchestrator transaction and resolves with its receipt.
///
/// `build` receives the contract and the overrides it must pass through as the
/// final argument, e.g.
///   sendOrchestratorTx("verify", (c, o) => c.verifySubtask(a, b, true, 90, o))
export async function sendOrchestratorTx(
  label: string,
  build: (
    contract: ethers.Contract,
    overrides: TxOverrides
  ) => Promise<ethers.ContractTransactionResponse>
): Promise<ethers.TransactionReceipt> {
  const run = queue.then(() => sendNow(label, build));
  // Keep the chain alive after a rejection so one failed transaction doesn't
  // permanently wedge every transaction queued behind it.
  queue = run.catch(() => undefined);
  return run;
}

async function sendNow(
  label: string,
  build: (
    contract: ethers.Contract,
    overrides: TxOverrides
  ) => Promise<ethers.ContractTransactionResponse>
): Promise<ethers.TransactionReceipt> {
  const c = getOrchestratorContract();
  if (!wallet) throw new Error("Orchestrator wallet not initialised");

  try {
    if (nextNonce === null) {
      nextNonce = await wallet.getNonce("pending");
      console.log(`[Orchestrator] Synced nonce from chain: ${nextNonce}`);
    }

    const nonce = nextNonce;
    const tx = await build(c, { nonce });

    // Only advance once the node has accepted the transaction — if `build`
    // throws, this nonce was never consumed.
    nextNonce = nonce + 1;
    console.log(`[Orchestrator] Sent ${label} (nonce ${nonce}): ${tx.hash}`);

    const receipt = await tx.wait(1, TX_TIMEOUT_MS);
    if (!receipt || receipt.status !== 1) {
      throw new Error(`Transaction reverted on-chain (${label}, tx ${tx.hash})`);
    }
    return receipt;
  } catch (err) {
    // Covers reverts, timeouts, and RPC errors alike: the local nonce can no
    // longer be trusted, so force a resync before the next send.
    nextNonce = null;
    throw err;
  }
}
