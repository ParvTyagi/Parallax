import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useWeb3 } from "../contexts/Web3Context";
import { API_URL } from "../lib/constants";
import { subtaskHeadline } from "../components/task/SubtaskSpec";
import {
  ExternalLink,
  Copy,
  Check,
  ArrowRight,
  User,
} from "lucide-react";

const STATE_BADGE: Record<string, { label: string; cls: string }> = {
  OPEN:            { label: "OPEN", cls: "badge-info" },
  CLAIMED:         { label: "CLAIMED", cls: "badge-warning" },
  SUBMITTED:       { label: "SUBMITTED", cls: "badge-secondary" },
  PENDING_RELEASE: { label: "DISPUTE WINDOW", cls: "badge-warning" },
  IN_DISPUTE:      { label: "IN DISPUTE", cls: "badge-error" },
  VERIFIED:        { label: "VERIFIED", cls: "badge-success" },
  FAILED:          { label: "FAILED", cls: "badge-error" },
  REJECTED:        { label: "REJECTED", cls: "badge-error" },
};

const WorkerProfile = () => {
  const { address } = useParams<{ address: string }>();
  const { account } = useWeb3();
  const [profile, setProfile] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [filterState, setFilterState] = useState<string>("ALL");

  const isMe = account?.toLowerCase() === address?.toLowerCase();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_URL}/api/workers/${address}`);
        if (res.ok) {
          const data = await res.json();
          setProfile(data.profile);
          setHistory(data.claimedSubtasks || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    if (address) fetchProfile();
  }, [address]);

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-80 gap-3">
        <span className="loading loading-spinner loading-md text-primary" />
        <span className="text-xs text-base-content/60 font-medium">Loading worker profile…</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="card bg-base-100 border border-base-300/80 p-12 text-center max-w-md mx-auto mt-12">
        <div className="space-y-3">
          <User className="w-8 h-8 text-base-content/60 mx-auto" />
          <h3 className="text-base font-bold text-base-content">Worker Profile Not Found</h3>
          <p className="text-xs text-base-content/60 font-mono">
            {address}
          </p>
          <Link to="/worker" className="btn btn-neutral btn-sm">
            Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  const totalCompleted = Number(profile.successfulTasks || 0);
  const totalFailed = Number(profile.failedTasks || 0);
  const totalTasks = totalCompleted + totalFailed;
  const successRate = totalTasks > 0 ? ((totalCompleted / totalTasks) * 100).toFixed(0) : "100";

  const filteredHistory = history.filter((st) => {
    if (filterState === "ALL") return true;
    return st.state === filterState;
  });

  return (
    <div className="animate-in fade-in duration-300 pb-20 space-y-8">
      {/* ─── Profile Hero Card ─── */}
      <div className="card bg-base-100 border border-base-300/80 shadow-xs">
        <div className="card-body p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-5 text-center md:text-left">
              {/* Avatar Identicon */}
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-500 to-amber-400 text-white font-mono font-extrabold text-xl flex items-center justify-center shadow-xs shrink-0">
                {address?.slice(2, 4).toUpperCase()}
              </div>

              {/* Identity Info */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <h1 className="text-lg md:text-xl font-bold font-mono text-base-content">
                    {address?.slice(0, 8)}…{address?.slice(-6)}
                  </h1>
                  {isMe && (
                    <span className="badge badge-success badge-sm font-semibold">
                      Connected Wallet
                    </span>
                  )}
                  {profile.reputationScore >= 80 && (
                    <span className="badge badge-warning badge-sm font-bold font-mono">
                      TOP 10%
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs text-base-content/60">
                  <button
                    onClick={copyAddress}
                    className="flex items-center gap-1 hover:text-base-content transition-colors font-mono cursor-pointer"
                  >
                    {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? "Copied" : "Copy Address"}</span>
                  </button>
                  <span>•</span>
                  <span>{totalTasks} lifetime microtasks</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2.5">
              <a
                href={`https://testnet.monadexplorer.com/address/${address}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-sm btn-outline border-base-300 text-xs font-semibold gap-1.5"
              >
                <span>Monad Explorer</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Metric KPI Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="card bg-base-100 border border-base-300/80 shadow-xs">
          <div className="card-body p-4 md:p-5">
            <span className="text-[10px] font-bold text-base-content/60 uppercase tracking-wider block mb-1">
              Reputation
            </span>
            <div className="text-2xl font-bold font-mono text-base-content">
              {profile.reputationScore}
            </div>
            <span className="text-[11px] text-base-content/60">Tier metric</span>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300/80 shadow-xs">
          <div className="card-body p-4 md:p-5">
            <span className="text-[10px] font-bold text-base-content/60 uppercase tracking-wider block mb-1">
              Completed
            </span>
            <div className="text-2xl font-bold font-mono text-success">
              {profile.successfulTasks ?? 0}
            </div>
            <span className="text-[11px] text-base-content/60">Verified work</span>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300/80 shadow-xs">
          <div className="card-body p-4 md:p-5">
            <span className="text-[10px] font-bold text-base-content/60 uppercase tracking-wider block mb-1">
              Slashed / Failed
            </span>
            <div className="text-2xl font-bold font-mono text-error">
              {profile.failedTasks ?? 0}
            </div>
            <span className="text-[11px] text-base-content/60">Forfeits & rejections</span>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300/80 shadow-xs">
          <div className="card-body p-4 md:p-5">
            <span className="text-[10px] font-bold text-base-content/60 uppercase tracking-wider block mb-1">
              Success Rate
            </span>
            <div className="text-2xl font-bold font-mono text-base-content">
              {successRate}%
            </div>
            <span className="text-[11px] text-base-content/60">Pass percentage</span>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300/80 shadow-xs col-span-2 lg:col-span-1">
          <div className="card-body p-4 md:p-5">
            <span className="text-[10px] font-bold text-base-content/60 uppercase tracking-wider block mb-1">
              Bonded (MON)
            </span>
            <div className="text-2xl font-bold font-mono text-base-content">
              {Number(profile.activeBondTotal || 0).toFixed(2)}
            </div>
            <span className="text-[11px] text-base-content/60">Locked against open claims</span>
          </div>
        </div>
      </div>

      {/* ─── Task History Table ─── */}
      <div className="card bg-base-100 border border-base-300/80 shadow-xs">
        <div className="card-body p-6 gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-base-content">Task History & Deliverables</h2>
              <p className="text-xs text-base-content/60 mt-0.5">
                All claimed microtasks, verification statuses, and on-chain payouts.
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1">
              {["ALL", "VERIFIED", "PENDING_RELEASE", "IN_DISPUTE", "SUBMITTED", "CLAIMED"].map((state) => (
                <button
                  key={state}
                  type="button"
                  onClick={() => setFilterState(state)}
                  className={`btn btn-xs ${
                    filterState === state
                      ? "btn-neutral"
                      : "btn-ghost text-base-content/60"
                  } text-[11px] font-medium`}
                >
                  {state}
                </button>
              ))}
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="p-8 text-center bg-base-200/40 rounded-xl border border-base-300/60">
              <p className="text-xs text-base-content/60">No task activity found for this filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm w-full">
                <thead>
                  <tr className="border-b border-base-300 text-base-content/60 text-[11px] uppercase tracking-wider">
                    <th className="font-semibold py-3">Task ID</th>
                    <th className="font-semibold py-3">Subtask Description</th>
                    <th className="font-semibold py-3">Reward</th>
                    <th className="font-semibold py-3">Status</th>
                    <th className="font-semibold py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-300/60 text-xs">
                  {filteredHistory.map((st: any) => {
                    const badge = STATE_BADGE[st.state] || { label: st.state, cls: "badge-ghost" };
                    return (
                      <tr key={st.subtaskId} className="hover:bg-base-200/40 transition-colors">
                        <td className="font-mono text-xs text-base-content/60 py-3.5">
                          #{st.taskId?.slice(0, 8)}
                        </td>
                        <td className="max-w-md py-3.5">
                          <p className="font-semibold text-base-content truncate">
                            {subtaskHeadline(st)}
                          </p>
                          <span className="text-[10px] font-mono text-base-content/60 uppercase">
                            {st.rangeLabel}
                          </span>
                        </td>
                        <td className="font-mono font-bold text-base-content py-3.5">
                          {st.reward} MON
                        </td>
                        <td className="py-3.5">
                          <span className={`badge badge-xs ${badge.cls} font-mono font-bold`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="text-right py-3.5">
                          <Link
                            to={`/task/${st.taskId}`}
                            className="btn btn-ghost btn-xs text-xs font-semibold gap-1 text-primary"
                          >
                            <span>View</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkerProfile;


