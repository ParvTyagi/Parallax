import { ethers } from "ethers";
import dotenv from "dotenv";
import { getDeployment } from "./deployments";

dotenv.config();

const TASK_MANAGER_ABI = [
  "function verifySubtask(bytes32 taskId, bytes32 subtaskId, bool passed, uint8 score) external"
];

/// How long to wait for a submitted transaction to mine before giving up on it.
/// Without a bound, one stalled transaction would block the orchestrator queue
/// forever and no payout would ever be released again.
const TX_TIMEOUT_MS = Number(process.env.ORCHESTRATOR_TX_TIMEOUT_MS || 120000);

let wallet: ethers.Wallet | null = null;
const contracts = new Map<string, ethers.Contract>();

export function getOrchestratorContract(address?: string | null): ethers.Contract {
  const taskManagerAddress = getDeployment(address).taskManagerAddress;
  const key = taskManagerAddress.toLowerCase();
  const existing = contracts.get(key);
  if (existing) return existing;

  const rpcUrl =
    process.env.ETH_RPC_URL ||
    process.env.ETHEREUM_RPC_URL ||
    process.env.RPC_URL ||
    process.env.MONAD_RPC_URL;
  const pk = process.env.ORCHESTRATOR_PRIVATE_KEY;

  if (!rpcUrl || !pk || !taskManagerAddress) {
    throw new Error("Missing orchestrator credentials (need ETH_RPC_URL/RPC_URL, ORCHESTRATOR_PRIVATE_KEY, TASKMANAGER_ADDRESS)");
  }

  const formattedPk = pk.startsWith("0x") ? pk : `0x${pk}`;
  if (!wallet) wallet = new ethers.Wallet(formattedPk, new ethers.JsonRpcProvider(rpcUrl));
  const contract = new ethers.Contract(taskManagerAddress, TASK_MANAGER_ABI, wallet);
  contracts.set(key, contract);
  return contract;
}

/// Serialises every transaction sent from the orchestrator key. The verify
/// jobs share that key;
/// letting each pick its own nonce means overlapping sends collide and one
/// silently replaces the other. One key, one in-flight transaction.
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
  ) => Promise<ethers.ContractTransactionResponse>,
  address?: string | null
): Promise<ethers.TransactionReceipt> {
  const run = queue.then(() => sendNow(label, build, address));
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
  ) => Promise<ethers.ContractTransactionResponse>,
  address?: string | null
): Promise<ethers.TransactionReceipt> {
  const c = getOrchestratorContract(address);
  if (!wallet) throw new Error("Orchestrator wallet not initialised");

  try {
    if (nextNonce === null) {
      nextNonce = await wallet.getNonce("pending");
      console.log(`[Orchestrator] Synced nonce from chain: ${nextNonce}`);
    }

    const nonce = nextNonce;
    const tx = await build(c, { nonce });

    // Advance only once accepted: if `build` throws, the nonce was not used.
    nextNonce = nonce + 1;
    console.log(`[Orchestrator] Sent ${label} (nonce ${nonce}): ${tx.hash}`);

    const receipt = await tx.wait(1, TX_TIMEOUT_MS);
    if (!receipt || receipt.status !== 1) {
      throw new Error(`Transaction reverted on-chain (${label}, tx ${tx.hash})`);
    }
    return receipt;
  } catch (err) {
    // Reverts, timeouts and RPC errors alike invalidate the local nonce.
    nextNonce = null;
    throw err;
  }
}
