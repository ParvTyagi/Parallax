import { PageLoading, PageError } from "../components/ui/PageState";
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useWeb3 } from "../contexts/Web3Context";
import { API_URL, BLOCK_EXPLORER_URL } from "../lib/constants";
import { subtaskHeadline } from "../components/task/SubtaskSpec";
import {
  ExternalLink,
  Copy,
  Check,
  ArrowRight,
} from "lucide-react";

const STATE_BADGE: Record<string, { label: string; cls: string }> = {
  OPEN:            { label: "OPEN", cls: "badge-info" },
  CLAIMED:         { label: "CLAIMED", cls: "badge-warning" },
  SUBMITTED:       { label: "SUBMITTED", cls: "badge-secondary" },
  IN_DISPUTE:      { label: "IN DISPUTE", cls: "badge-error" },
  VERIFIED:        { label: "VERIFIED", cls: "badge-success" },
  FAILED:          { label: "FAILED", cls: "badge-error" },
  VERIFICATION_FAILED: { label: "VERIFICATION FAILED", cls: "badge-error" },
  REJECTED:        { label: "REJECTED", cls: "badge-error" },
};

const WorkerProfile = () => {
  const { address } = useParams<{ address: string }>();
  const { account, currencySymbol } = useWeb3();
  const currency = currencySymbol || "MON";
  const [profile, setProfile] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [copyError, setCopyError] = useState("");
  const [copied, setCopied] = useState(false);
  const [filterState, setFilterState] = useState<string>("ALL");

  const isMe = account?.toLowerCase() === address?.toLowerCase();

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const fetchProfile = async () => {
      try {
        setLoading(true); setError(""); setProfile(null); setHistory([]);
        const res = await fetch(`${API_URL}/api/workers/${address}`, { signal: controller.signal });
        if (!res.ok) throw new Error(res.status === 404 ? "This address has no worker profile yet." : "We could not load this profile. Please try again.");
        if (res.ok) {
          const data = await res.json();
          if (cancelled) return;
          setProfile(data.profile);
          setHistory(data.claimedSubtasks || []);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Profile unavailable. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (address) fetchProfile();
    return () => { cancelled = true; controller.abort(); };
  }, [address, refresh]);

  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true); setCopyError("");
      setTimeout(() => setCopied(false), 2000);
    } catch { setCopyError("Could not copy the address. Select it from the explorer link."); }
  };

  if (loading) return <PageLoading label="Loading contributor profile…" />;
  if (!profile) return <PageError title={error ? "Profile unavailable" : "No contribution history yet"} message={error || "This address has not contributed to a project yet."} onRetry={() => setRefresh(v => v + 1)}><Link className="btn btn-outline" to="/worker">Explore work</Link></PageError>;

  const totalCompleted = Number(profile.successfulTasks || 0);
  const totalFailed = Number(profile.failedTasks || 0);
  const totalTasks = totalCompleted + totalFailed;
  const successRate = totalTasks > 0 ? ((totalCompleted / totalTasks) * 100).toFixed(0) : null;

  const filteredHistory = history.filter((st) => {
    if (filterState === "ALL") return true;
    return st.state === filterState;
  });

  return (
    <div className="profile-page animate-in fade-in duration-300 pb-20 space-y-8">
      <div className="product-page-heading"><p className="eyebrow">Contributor identity</p><h1>{isMe ? "Your contribution, in focus." : "A record of meaningful work."}</h1><p>Verified deliveries, reputation, and an on-chain work history.</p></div>
      {copyError && <p role="alert" className="alert alert-error">{copyError}</p>}
      <span role="status" className="sr-only">{copied ? "Address copied" : ""}</span>
      {/* ─── Profile Hero Card ─── */}
      <div className="card bg-base-100 border border-base-300/80 shadow-xs">
        <div className="card-body p-6 md:p-8">
          <div className="profile-identity">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-5 text-center md:text-left">
              {/* Avatar Identicon */}
              <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white font-mono font-extrabold text-xl flex items-center justify-center shadow-xs shrink-0">
                {address?.slice(2, 4).toUpperCase()}
              </div>

              {/* Identity Info */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <h2 className="text-lg md:text-xl font-bold font-mono text-base-content">
                    {address?.slice(0, 8)}…{address?.slice(-6)}
                  </h2>
                  {isMe && (
                    <span className="badge badge-success badge-sm font-semibold">
                      Connected Wallet
                    </span>
                  )}
                  {profile.reputationScore >= 80 && (
                    <span className="badge badge-warning badge-sm font-bold font-mono">
                      HIGH REPUTATION
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
                href={`${BLOCK_EXPLORER_URL}/address/${address}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-sm btn-outline border-base-300 text-xs font-semibold gap-1.5"
              >
                <span>View on explorer</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Metric KPI Cards ─── */}
      <div className="profile-metrics">
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
              {successRate === null ? "—" : `${successRate}%`}
            </div>
            <span className="text-[11px] text-base-content/60">Pass percentage</span>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300/80 shadow-xs">
          <div className="card-body p-4 md:p-5">
            <span className="text-[10px] font-bold text-base-content/60 uppercase tracking-wider block mb-1">
              Bonded ({currency})
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
          <div className="history-heading">
            <div>
              <h2 className="text-base font-bold text-base-content">Contribution history</h2>
              <p className="text-xs text-base-content/60 mt-0.5">
                All claimed microtasks, verification statuses, and on-chain payouts.
              </p>
            </div>

            {/* Filter Pills */}
            <div className="profile-filters" role="group" aria-label="Filter contribution history">
              {["ALL", "VERIFIED", "VERIFICATION_FAILED", "IN_DISPUTE", "SUBMITTED", "CLAIMED"].map((state) => (
                <button
                  key={state}
                  type="button"
                  aria-pressed={filterState === state}
                  onClick={() => setFilterState(state)}
                  className={`btn btn-xs ${
                    filterState === state
                      ? "btn-neutral"
                      : "btn-ghost text-base-content/60"
                  } text-[11px] font-medium`}
                >
                  {state === "ALL" ? "All work" : STATE_BADGE[state]?.label.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) || state}
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
              <table className="responsive-records table table-sm w-full">
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
                        <td data-label="Task" className="max-w-md py-3.5">
                          <p className="font-semibold text-base-content truncate">
                            {subtaskHeadline(st)}
                          </p>
                          <span className="text-[10px] font-mono text-base-content/60 uppercase">
                            {st.rangeLabel}
                          </span>
                        </td>
                        <td data-label="Reward" className="font-mono font-bold text-base-content py-3.5">
                          {st.reward} {currency}
                        </td>
                        <td data-label="Status" className="py-3.5">
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


