import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useWeb3 } from "../contexts/Web3Context";
import {
  CheckCircle2,
  Clock,
  GitBranch,
  ShieldCheck,
  ArrowLeft,
  Download,
  ExternalLink,
  Send,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { API_URL } from "../lib/constants";

const STATE_BADGE: Record<string, { label: string; cls: string }> = {
  OPEN:      { label: "OPEN", cls: "badge-info" },
  CLAIMED:   { label: "CLAIMED", cls: "badge-warning" },
  SUBMITTED: { label: "SUBMITTED", cls: "badge-secondary" },
  VERIFIED:  { label: "VERIFIED", cls: "badge-success" },
  FAILED:    { label: "FAILED", cls: "badge-error" },
};

const TaskDetail = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const { account, signer, taskManager, connectWallet } = useWeb3();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState("");
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [forfeitingId, setForfeitingId] = useState<string | null>(null);
  const [statusMessages, setStatusMessages] = useState<Record<string, string>>({});
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTask();
  }, [taskId]);

  const fetchTask = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/tasks/${taskId}`);
      if (res.ok) setTask(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const setMsg = (id: string, msg: string) =>
    setStatusMessages((p) => ({ ...p, [id]: msg }));
  const clearMsg = (id: string) =>
    setStatusMessages((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });

  const handleClaim = async (subtaskId: string) => {
    if (!account) {
      await connectWallet();
      return;
    }
    setClaimingId(subtaskId);
    try {
      const txData = taskManager!.interface.encodeFunctionData("claimSubtask", [
        taskId,
        subtaskId,
      ]);
      await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: await signer!.getAddress(),
            to: await taskManager!.getAddress(),
            data: txData,
            gas: "0x186A0",
          },
        ],
      });
      setMsg(subtaskId, "Claimed successfully! Refreshing state…");
      setTimeout(() => {
        fetchTask();
        clearMsg(subtaskId);
      }, 3000);
    } catch (e: any) {
      setMsg(subtaskId, "Error: " + e.message);
    } finally {
      setClaimingId(null);
    }
  };

  const handleSubmit = async (subtaskId: string) => {
    if (!submission.trim()) return;
    setSubmittingId(subtaskId);
    try {
      const ipfsRes = await fetch(`${API_URL}/api/ipfs/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: submission }),
      });
      const ipfsData = await ipfsRes.json();
      if (!ipfsRes.ok) throw new Error(ipfsData.error);

      const txData = taskManager!.interface.encodeFunctionData("submitWork", [
        taskId,
        subtaskId,
        ipfsData.cid,
      ]);
      await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: await signer!.getAddress(),
            to: await taskManager!.getAddress(),
            data: txData,
            gas: "0x186A0",
          },
        ],
      });
      setMsg(subtaskId, "Work submitted to IPFS & recorded on-chain. Ready for AI verification!");
      setSubmission("");
      setTimeout(() => {
        fetchTask();
        clearMsg(subtaskId);
      }, 4000);
    } catch (e: any) {
      setMsg(subtaskId, "Error: " + e.message);
    } finally {
      setSubmittingId(null);
    }
  };

  const handleVerify = async (subtaskId: string) => {
    setVerifyingId(subtaskId);
    try {
      const res = await fetch(`${API_URL}/api/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, subtaskId }),
      });
      const data = await res.json();
      setMsg(
        subtaskId,
        data.passed
          ? "AI approved the submission! On-chain reward released to worker."
          : `Evaluation Score: ${data.score}/100. ${data.reasons?.[0] || "Requirements not met."}`
      );
      setTimeout(() => {
        fetchTask();
        clearMsg(subtaskId);
      }, 4000);
    } catch (e: any) {
      setMsg(subtaskId, "Verification error: " + e.message);
    } finally {
      setVerifyingId(null);
    }
  };

  const handleForfeit = async (subtaskId: string) => {
    if (!window.confirm("Are you sure you want to forfeit this task? Your staked deposit will be slashed."))
      return;
    setForfeitingId(subtaskId);
    try {
      const txData = taskManager!.interface.encodeFunctionData("forfeitSubtask", [
        taskId,
        subtaskId,
      ]);
      await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: await signer!.getAddress(),
            to: await taskManager!.getAddress(),
            data: txData,
            gas: "0x186A0",
          },
        ],
      });
      setMsg(subtaskId, "Forfeited. Task re-opened in marketplace.");
      setTimeout(() => {
        fetchTask();
        clearMsg(subtaskId);
      }, 3000);
    } catch (e: any) {
      setMsg(subtaskId, "Error: " + e.message);
    } finally {
      setForfeitingId(null);
    }
  };

  const handleDownload = async (submissionCID: string, subtaskId: string) => {
    setDownloadingId(subtaskId);
    try {
      const res = await fetch(`https://gateway.pinata.cloud/ipfs/${submissionCID}`);
      const text = await res.text();
      const blob = new Blob([text], { type: "text/plain" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Parallax_Deliverable_${(taskId ?? "").substring(0, 8)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-80 gap-3">
        <span className="loading loading-spinner loading-md text-primary" />
        <span className="text-xs text-base-content/50 font-medium">Loading execution graph…</span>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="card bg-base-100 border border-base-300/80 p-12 text-center max-w-md mx-auto mt-12">
        <div className="space-y-3">
          <AlertTriangle className="w-8 h-8 text-warning mx-auto" />
          <h3 className="text-base font-bold text-base-content">Task Not Found</h3>
          <p className="text-xs text-base-content/50">
            The requested task ID could not be retrieved from the network.
          </p>
          <Link to="/app" className="btn btn-neutral btn-sm">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const verifiedCount = task.subtasks.filter((st: any) => st.state === "VERIFIED").length;
  const totalCount = task.subtasks.length;
  const progressPercent = totalCount > 0 ? (verifiedCount / totalCount) * 100 : 0;
  const totalBudget = task.subtasks
    .reduce((acc: number, st: any) => acc + Number(st.reward || 0), 0)
    .toFixed(2);
  const mockEscrowHash = "0x9fa" + (taskId || "").substring(0, 12).toLowerCase();

  return (
    <div className="animate-in fade-in duration-300 pb-20">
      {/* ─── Back Nav ─── */}
      <div className="mb-6">
        <Link
          to="/worker"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-base-content/60 hover:text-base-content transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Marketplace</span>
        </Link>
      </div>

      {/* ─── Header Overview Card ─── */}
      <div className="card bg-base-100 border border-base-300/80 shadow-xs mb-8">
        <div className="card-body p-6 md:p-8">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge badge-neutral font-mono text-[10px] uppercase font-bold">
                  TASK #{taskId?.slice(0, 8)}
                </span>
                <span className="badge badge-outline text-[11px] font-medium">
                  {totalCount} Subtasks Total
                </span>
              </div>

              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-base-content leading-snug">
                {task.description}
              </h1>

              {task.customerAddress && (
                <div className="flex items-center gap-2 text-xs text-base-content/50 font-mono pt-1">
                  <span>Creator:</span>
                  <span className="text-base-content font-medium truncate max-w-xs">
                    {task.customerAddress}
                  </span>
                </div>
              )}
            </div>

            {/* Quick Metrics */}
            <div className="flex flex-wrap items-center gap-4 shrink-0 bg-base-200/60 border border-base-300/80 rounded-xl p-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/40 block mb-0.5">
                  Total Escrow
                </span>
                <span className="text-xl font-mono font-bold text-base-content">
                  {totalBudget} <span className="text-xs font-sans text-base-content/50">MON</span>
                </span>
              </div>

              <div className="h-8 w-px bg-base-300" />

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/40 block mb-0.5">
                  Status
                </span>
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  {progressPercent === 100 ? (
                    <span className="badge badge-success badge-sm font-bold gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Fully Verified
                    </span>
                  ) : (
                    <span className="badge badge-warning badge-sm font-bold gap-1">
                      <Clock className="w-3 h-3" /> In Progress
                    </span>
                  )}
                </div>
              </div>

              <div className="h-8 w-px bg-base-300" />

              <div className="w-32">
                <div className="flex justify-between text-[11px] text-base-content/60 mb-1">
                  <span>Progress</span>
                  <span className="font-mono font-bold">{progressPercent.toFixed(0)}%</span>
                </div>
                <progress
                  className="progress progress-success w-full h-1.5"
                  value={progressPercent}
                  max={100}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main View: Execution Graph & Sidebar ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Subtask Pipeline (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="flex items-center gap-2 text-xs font-bold text-base-content/60 uppercase tracking-wider">
              <GitBranch className="w-4 h-4" />
              <span>Decomposed Execution Graph</span>
            </h3>
            <span className="text-xs text-base-content/40 font-mono font-medium">
              {verifiedCount} / {totalCount} verified
            </span>
          </div>

          {task.subtasks.map((st: any, index: number) => {
            const isWorker = account?.toLowerCase() === st.workerAddress?.toLowerCase();
            const isCustomer = account?.toLowerCase() === task.customerAddress?.toLowerCase();
            const stateMeta = STATE_BADGE[st.state] || { label: st.state, cls: "badge-ghost" };

            return (
              <div
                key={st.subtaskId}
                className={`card bg-base-100 border border-base-300/80 shadow-xs transition-all ${
                  st.state === "VERIFIED" ? "bg-base-100/70" : ""
                }`}
              >
                <div className="card-body p-5 md:p-6 gap-4">
                  {/* Subtask Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-base-200 border border-base-300 flex items-center justify-center text-xs font-mono font-bold shrink-0">
                        {index + 1}
                      </div>
                      <div>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-base-content/40 block mb-0.5">
                          {st.rangeLabel || `Phase ${index + 1}`}
                        </span>
                        <h4 className="text-sm font-semibold text-base-content leading-snug">
                          {st.description}
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="badge badge-neutral font-mono font-bold text-xs">
                        {st.reward} MON
                      </span>
                      <span className={`badge badge-xs ${stateMeta.cls} font-mono font-bold`}>
                        {stateMeta.label}
                      </span>
                    </div>
                  </div>

                  {/* Worker Attribution (if claimed) */}
                  {st.workerAddress && (
                    <div className="flex items-center gap-2 text-xs text-base-content/50 font-mono bg-base-200/40 p-2.5 rounded-lg border border-base-300/60">
                      <span className="text-[11px] text-base-content/60">Worker:</span>
                      <Link
                        to={`/worker/${st.workerAddress}`}
                        className="text-base-content hover:underline truncate font-medium"
                      >
                        {st.workerAddress}
                      </Link>
                    </div>
                  )}

                  {/* Status Banner */}
                  {statusMessages[st.subtaskId] && (
                    <div role="alert" className="alert alert-info text-xs py-2">
                      <span>{statusMessages[st.subtaskId]}</span>
                    </div>
                  )}

                  {/* Verified State Feedback */}
                  {st.state === "VERIFIED" && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-success/10 border border-success/20 text-success text-xs font-medium">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>AI Verified • Payment released directly to worker</span>
                      </div>
                    </div>
                  )}

                  {/* OPEN State: Claim CTA */}
                  {st.state === "OPEN" && (
                    <div className="pt-2 border-t border-base-300/60 flex items-center justify-between">
                      <span className="text-xs text-base-content/50">
                        Requires worker staking deposit
                      </span>
                      <button
                        type="button"
                        onClick={() => handleClaim(st.subtaskId)}
                        disabled={claimingId === st.subtaskId}
                        className="btn btn-neutral btn-sm font-bold text-xs"
                      >
                        {claimingId === st.subtaskId ? (
                          <span className="flex items-center gap-2">
                            <span className="loading loading-spinner loading-xs" />
                            Claiming…
                          </span>
                        ) : (
                          "Claim & Stake Subtask"
                        )}
                      </button>
                    </div>
                  )}

                  {/* CLAIMED State & Worker: Deliverable Submission */}
                  {st.state === "CLAIMED" && isWorker && (
                    <div className="pt-2 border-t border-base-300/60 space-y-3">
                      <label className="text-xs font-bold text-base-content uppercase tracking-wider block">
                        Submit Your Deliverable
                      </label>
                      <textarea
                        rows={4}
                        placeholder="Paste your final deliverable (e.g. analysis report, code, markdown data)..."
                        className="textarea textarea-bordered w-full text-xs leading-relaxed"
                        value={submission}
                        onChange={(e) => setSubmission(e.target.value)}
                        disabled={submittingId === st.subtaskId}
                      />
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => handleForfeit(st.subtaskId)}
                          disabled={forfeitingId === st.subtaskId}
                          className="btn btn-ghost btn-xs text-error hover:bg-error/10"
                        >
                          {forfeitingId === st.subtaskId ? "Forfeiting…" : "Forfeit Subtask"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSubmit(st.subtaskId)}
                          disabled={submittingId === st.subtaskId || !submission.trim()}
                          className="btn btn-neutral btn-sm font-bold text-xs gap-1.5"
                        >
                          {submittingId === st.subtaskId ? (
                            <span className="loading loading-spinner loading-xs" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          <span>Submit Deliverable</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* SUBMITTED State: AI Verification or Download */}
                  {st.state === "SUBMITTED" && (
                    <div className="pt-2 border-t border-base-300/60 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-base-content/60">
                          Deliverable submitted to IPFS.
                        </span>
                        {st.submissionCID && (
                          <button
                            type="button"
                            onClick={() => handleDownload(st.submissionCID, st.subtaskId)}
                            disabled={downloadingId === st.subtaskId}
                            className="btn btn-ghost btn-xs text-xs gap-1"
                          >
                            <Download className="w-3 h-3" />
                            Download
                          </button>
                        )}
                      </div>

                      {isCustomer && (
                        <button
                          type="button"
                          onClick={() => handleVerify(st.subtaskId)}
                          disabled={verifyingId === st.subtaskId}
                          className="btn btn-neutral btn-sm font-bold text-xs gap-1.5"
                        >
                          {verifyingId === st.subtaskId ? (
                            <span className="flex items-center gap-2">
                              <span className="loading loading-spinner loading-xs" />
                              Running Gemini AI Verification…
                            </span>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-accent" />
                              <span>Run AI Verification</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: On-Chain Proofs & Transparency (1 col) */}
        <div className="space-y-5">
          {/* On-Chain Escrow Proofs */}
          <div className="card bg-base-100 border border-base-300/80 shadow-xs">
            <div className="card-body p-5 gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-base-content uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4 text-warning" />
                  <span>On-Chain Escrow</span>
                </div>
                <span className="badge badge-xs badge-outline font-mono">Monad</span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-base-200/60 border border-base-300">
                  <span className="text-base-content/60">Escrow Contract Tx</span>
                  <a
                    href={`https://testnet.monadexplorer.com/tx/${mockEscrowHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-primary hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>{mockEscrowHash.slice(0, 8)}…</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {task.subtasks.map((st: any) => {
                  if (st.state !== "VERIFIED") return null;
                  const payHash = "0x72c" + st.subtaskId.substring(0, 10).toLowerCase();
                  return (
                    <div
                      key={st.subtaskId}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-success/5 border border-success/20"
                    >
                      <div>
                        <span className="text-[11px] font-bold text-success block">Payout Tx</span>
                        <span className="text-[10px] text-base-content/40 uppercase">
                          {st.rangeLabel}
                        </span>
                      </div>
                      <a
                        href={`https://testnet.monadexplorer.com/tx/${payHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                      >
                        <span>{payHash.slice(0, 8)}…</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Decentralized AI Protocol Explainer */}
          <div className="card bg-base-100 border border-base-300/80 shadow-xs">
            <div className="card-body p-5 gap-3 text-xs text-base-content/70 leading-relaxed">
              <div className="flex items-center gap-2 font-bold text-base-content">
                <Sparkles className="w-4 h-4 text-accent" />
                <span>Verification Consensus</span>
              </div>
              <p>
                Submissions are pinned to IPFS and evaluated by the Gemini AI Orchestrator against the original master task parameters.
              </p>
              <p className="text-[11px] text-base-content/50">
                Upon meeting verification criteria (score ≥ 70/100), the orchestrator signs a transaction directly executing the release of funds from <code className="font-mono bg-base-200 px-1 py-0.5 rounded">ParallaxTaskManager.sol</code>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetail;



