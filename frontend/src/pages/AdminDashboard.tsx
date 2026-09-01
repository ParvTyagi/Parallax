import { useState, useEffect, useCallback } from "react";
import { useWeb3 } from "../contexts/Web3Context";
import { ethers } from "ethers";
import { API_URL } from "../lib/constants";
import {
  Landmark,
  ShieldCheck,
  AlertTriangle,
  Gavel,
  Settings2,
} from "lucide-react";

export default function AdminDashboard() {
  const { account, taskManager } = useWeb3();
  const [balance, setBalance] = useState("0.00");
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [adminAddress, setAdminAddress] = useState<string | null>(null);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [bondAmount, setBondAmount] = useState<string | null>(null);
  const [newBondAmount, setNewBondAmount] = useState("");
  const [updatingBond, setUpdatingBond] = useState(false);

  const fetchDisputes = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/tasks/disputes/open`);
      if (res.ok) setDisputes(await res.json());
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    checkAdmin();
  }, [account, taskManager]);

  useEffect(() => {
    if (isOwner) {
      fetchDisputes();
      const interval = setInterval(fetchDisputes, 8000);
      return () => clearInterval(interval);
    }
  }, [isOwner, fetchDisputes]);

  const checkAdmin = async () => {
    if (!account || !taskManager) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      // The admin role is read directly from the contract — it is a distinct address from the
      // platform treasury and can be rotated on-chain via setAdmin().
      const onChainAdmin: string = await taskManager.admin();
      setAdminAddress(onChainAdmin);
      const owner = account.toLowerCase() === onChainAdmin.toLowerCase();
      setIsOwner(owner);

      if (owner) {
        const escrowAddress = await taskManager.escrow();
        const escrowContract = new ethers.Contract(
          escrowAddress,
          ["function totalProtocolRevenue() view returns (uint256)"],
          taskManager.runner
        );
        const slashRev = await taskManager.totalProtocolRevenue();
        const feeRev = await escrowContract.totalProtocolRevenue();
        setBalance(ethers.formatEther(slashRev + feeRev));

        const bond = await taskManager.workerBondAmount();
        setBondAmount(ethers.formatEther(bond));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (taskId: string, subtaskId: string, workerWins: boolean) => {
    if (!taskManager) return;
    if (!window.confirm(`Resolve in favor of the ${workerWins ? "worker" : "creator"}?`)) return;
    setResolvingId(subtaskId);
    try {
      const tx = await taskManager.resolveDispute(taskId, subtaskId, workerWins);
      await tx.wait();
      await fetchDisputes();
    } catch (e: any) {
      console.error("Resolve dispute error:", e);
      alert(e.reason || e.info?.error?.message || e.message || "Resolution failed");
    } finally {
      setResolvingId(null);
    }
  };

  const handleUpdateBond = async () => {
    if (!taskManager || !newBondAmount) return;
    setUpdatingBond(true);
    try {
      const tx = await taskManager.setWorkerBondAmount(ethers.parseEther(newBondAmount));
      await tx.wait();
      setBondAmount(newBondAmount);
      setNewBondAmount("");
    } catch (e: any) {
      console.error("Update bond error:", e);
      alert(e.reason || e.info?.error?.message || e.message || "Update failed");
    } finally {
      setUpdatingBond(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-80 gap-3">
        <span className="loading loading-spinner loading-md text-primary" />
        <span className="text-xs text-base-content/60 font-medium">Verifying admin access…</span>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="card bg-base-100 border border-base-300/80 p-12 text-center max-w-md mx-auto mt-12">
        <div className="space-y-3">
          <div className="w-12 h-12 rounded-full bg-warning/10 text-warning flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-base-content">Access Restricted</h3>
          <p className="text-xs text-base-content/60">
            This section is restricted to the ParallaxTaskManager's on-chain{" "}
            <code className="font-mono text-[11px]">admin()</code> address
            {adminAddress ? (
              <>
                {" "}(<code className="font-mono text-[11px]">{adminAddress.slice(0, 8)}…{adminAddress.slice(-6)}</code>).
              </>
            ) : (
              "."
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300 pb-20 space-y-8">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge badge-warning badge-sm font-bold gap-1 font-mono">
              <ShieldCheck className="w-3 h-3" /> ADMIN ONLY
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-base-content">
            Protocol Administration
          </h1>
          <p className="text-xs md:text-sm text-base-content/60 mt-0.5">
            Dispute resolution, bond configuration, and protocol revenue on Monad.
          </p>
        </div>
      </div>

      {/* ─── Treasury Stats ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-base-100 border border-base-300/80 shadow-xs">
          <div className="card-body p-5">
            <span className="text-[10px] font-bold text-base-content/60 uppercase tracking-wider block mb-1">
              Lifetime Protocol Revenue
            </span>
            <div className="text-2xl md:text-3xl font-bold font-mono text-base-content">
              {balance} <span className="text-sm font-sans font-medium text-base-content/60">MON</span>
            </div>
            <span className="text-[11px] text-base-content/60">
              Already forwarded to the treasury wallet — nothing sits locked in-contract to withdraw.
            </span>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300/80 shadow-xs">
          <div className="card-body p-5">
            <span className="text-[10px] font-bold text-base-content/60 uppercase tracking-wider block mb-1">
              Platform Take Rate
            </span>
            <div className="text-2xl md:text-3xl font-bold font-mono text-success">
              5.0%
            </div>
            <span className="text-[11px] text-base-content/60">Deducted on successful settlement</span>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300/80 shadow-xs">
          <div className="card-body p-5">
            <span className="text-[10px] font-bold text-base-content/60 uppercase tracking-wider block mb-1">
              Slash Seizure Rate
            </span>
            <div className="text-2xl md:text-3xl font-bold font-mono text-base-content">
              100%
            </div>
            <span className="text-[11px] text-base-content/60">Of slashed worker bonds</span>
          </div>
        </div>
      </div>

      {/* ─── Dispute Resolution Queue ─── */}
      <div className="card bg-base-100 border border-base-300/80 shadow-xs">
        <div className="card-body p-6 gap-4">
          <div className="flex items-center gap-2">
            <Gavel className="w-4 h-4 text-error" />
            <h2 className="text-base font-bold text-base-content">Dispute Resolution Queue</h2>
            {disputes.length > 0 && (
              <span className="badge badge-error badge-sm font-mono">{disputes.length}</span>
            )}
          </div>

          {disputes.length === 0 ? (
            <p className="text-xs text-base-content/60 py-4">No open disputes.</p>
          ) : (
            <div className="space-y-3">
              {disputes.map((d) => (
                <div key={d.subtaskId} className="border border-base-300 rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-base-content">{d.description}</p>
                      <p className="text-[11px] text-base-content/60 font-mono mt-0.5">
                        Task #{d.taskId?.slice(0, 8)} · Worker {d.worker?.slice(0, 8)}…{d.worker?.slice(-4)}
                      </p>
                    </div>
                    <span className="badge badge-neutral font-mono text-xs shrink-0">{d.reward} MON</span>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-base-300/60">
                    <button
                      type="button"
                      onClick={() => handleResolve(d.taskId, d.subtaskId, true)}
                      disabled={resolvingId === d.subtaskId}
                      className="btn btn-success btn-xs font-semibold"
                    >
                      Rule for Worker
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResolve(d.taskId, d.subtaskId, false)}
                      disabled={resolvingId === d.subtaskId}
                      className="btn btn-error btn-xs font-semibold"
                    >
                      Rule for Creator
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Bond Configuration & Revenue Mechanics ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card bg-base-100 border border-base-300/80 shadow-xs">
          <div className="card-body p-6 gap-4">
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-info" />
              <h2 className="text-base font-bold text-base-content">Worker Bond Amount</h2>
            </div>
            <p className="text-xs text-base-content/60">
              MON a worker must post to claim any subtask. Current: <span className="font-mono font-bold text-base-content">{bondAmount ?? "…"} MON</span>
            </p>
            <div className="flex items-center gap-2">
              <input
                id="admin-bond-amount"
                type="number"
                min="0"
                step="0.001"
                placeholder="New bond amount (MON)"
                aria-label="New worker bond amount in MON"
                className="input input-sm input-bordered flex-1 text-xs"
                value={newBondAmount}
                onChange={(e) => setNewBondAmount(e.target.value)}
              />
              <button
                type="button"
                onClick={handleUpdateBond}
                disabled={updatingBond || !newBondAmount}
                className="btn btn-neutral btn-sm text-xs font-semibold"
              >
                {updatingBond ? "Updating…" : "Update"}
              </button>
            </div>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300/80 shadow-xs">
          <div className="card-body p-6 gap-4">
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-accent" />
              <h2 className="text-base font-bold text-base-content">Revenue Mechanics</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="table table-sm w-full">
                <thead>
                  <tr className="border-b border-base-300 text-base-content/60 text-[11px] uppercase tracking-wider">
                    <th className="font-semibold py-2.5">Revenue Stream</th>
                    <th className="font-semibold py-2.5">Trigger Condition</th>
                    <th className="font-semibold py-2.5">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-300/60 text-xs">
                  <tr>
                    <td className="font-semibold text-base-content py-3">Task Completion Fee</td>
                    <td className="text-base-content/60 py-3">Deducted when a subtask's payout releases</td>
                    <td className="py-3 font-mono font-bold text-success">5.0%</td>
                  </tr>
                  <tr>
                    <td className="font-semibold text-base-content py-3">Bond Slash Penalty</td>
                    <td className="text-base-content/60 py-3">Seized on failed verification, spam forfeit, or a lost dispute</td>
                    <td className="py-3 font-mono font-bold text-error">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="p-3 bg-base-200/50 rounded-xl border border-base-300/60 text-xs text-base-content/60 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-warning shrink-0" />
              <span>
                Admin authority verified on-chain: <code className="font-mono text-base-content">{account?.slice(0, 8)}…{account?.slice(-6)}</code>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
