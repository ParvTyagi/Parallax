import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ethers } from "ethers";
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
  CREATED:   { label: "OPEN", cls: "badge-info" },
  CLAIMED:   { label: "CLAIMED", cls: "badge-warning" },
  SUBMITTED: { label: "SUBMITTED", cls: "badge-secondary" },
  VERIFIED:  { label: "VERIFIED", cls: "badge-success" },
  FAILED:    { label: "FAILED", cls: "badge-error" },
  REJECTED:  { label: "FAILED", cls: "badge-error" },
};

const TaskDetail = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const { account, taskManager, connectWallet } = useWeb3();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState("");
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [forfeitingId, setForfeitingId] = useState<string | null>(null);
  const [statusMessages, setStatusMessages] = useState<Record<string, string>>({});
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [cancellingTask, setCancellingTask] = useState(false);
  const [cancelStatus, setCancelStatus] = useState("");

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
    if (!taskManager) {
      setMsg(subtaskId, "Wallet not connected. Please connect your Web3 wallet.");
      return;
    }
    setClaimingId(subtaskId);
    try {
      setMsg(subtaskId, "Confirming claim in MetaMask…");
      const tx = await taskManager.claimSubtask(taskId, subtaskId);
      setMsg(subtaskId, "Transaction submitted! Waiting for confirmation…");
      await tx.wait();
      setMsg(subtaskId, "Claimed successfully! Refreshing state…");
      setTimeout(() => {
        fetchTask();
        clearMsg(subtaskId);
      }, 2000);
    } catch (e: any) {
      console.error("Claim error:", e);
      setMsg(subtaskId, "Error: " + (e.reason || e.info?.error?.message || e.message || "Claim transaction failed"));
    } finally {
      setClaimingId(null);
    }
  };

  const handleSubmit = async (subtaskId: string) => {
    if (!submission.trim()) return;
    if (!taskManager) {
      setMsg(subtaskId, "Wallet not connected. Please connect your Web3 wallet.");
      return;
    }
    setSubmittingId(subtaskId);
    try {
      setMsg(subtaskId, "Uploading deliverable to IPFS…");
      const ipfsRes = await fetch(`${API_URL}/api/ipfs/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: submission }),
      });
      const ipfsData = await ipfsRes.json();
      if (!ipfsRes.ok) throw new Error(ipfsData.error || "IPFS upload failed");

      setMsg(subtaskId, "Recording submission proof on Monad…");
      const submissionHash = ethers.id(ipfsData.cid);
      const tx = await taskManager.recordSubmissionProof(
        taskId,
        subtaskId,
        submissionHash
      );
      setMsg(subtaskId, "Transaction submitted! Waiting for confirmation…");
      await tx.wait();

      // Notify backend of submission for real-time tracking
      try {
        await fetch(`${API_URL}/api/submissions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subtaskId,
            worker: account,
            content: submission
          })
        });
      } catch (subErr) {
        console.warn("Backend submission sync note:", subErr);
      }

      setMsg(subtaskId, "Work submitted to IPFS & recorded on-chain. Ready for AI verification!");
      setSubmission("");
      setTimeout(() => {
        fetchTask();
        clearMsg(subtaskId);
      }, 3000);
    } catch (e: any) {
      console.error("Submit error:", e);
      setMsg(subtaskId, "Error: " + (e.reason || e.info?.error?.message || e.message || "Submission failed"));
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
      setMsg(subtaskId, "Verification error: " + (e.message || "Verification failed"));
    } finally {
      setVerifyingId(null);
    }
  };

  const handleForfeit = async (subtaskId: string) => {
    if (!window.confirm("Are you sure you want to forfeit this task? Your staked deposit will be slashed."))
      return;
    if (!taskManager) {
      setMsg(subtaskId, "Wallet not connected. Please connect your Web3 wallet.");
      return;
    }
    setForfeitingId(subtaskId);
    try {
      setMsg(subtaskId, "Confirming forfeit on Monad…");
      const tx = await taskManager.forfeitClaim(taskId, subtaskId);
      setMsg(subtaskId, "Transaction submitted! Waiting for confirmation…");
      await tx.wait();
      setMsg(subtaskId, "Forfeited. Task re-opened in marketplace.");
      setTimeout(() => {
        fetchTask();
        clearMsg(subtaskId);
      }, 2000);
    } catch (e: any) {
      console.error("Forfeit error:", e);
      setMsg(subtaskId, "Error: " + (e.reason || e.info?.error?.message || e.message || "Forfeit failed"));
    } finally {
      setForfeitingId(null);
    }
  };

  const handleCancelTask = async () => {
    if (!taskId) return;
    if (!window.confirm("Are you sure you want to cancel this project? All remaining escrowed funds will be refunded directly to your wallet."))
      return;
    if (!taskManager) {
      alert("Wallet not connected. Please connect your Web3 wallet.");
      return;
    }
    setCancellingTask(true);
    setCancelStatus("Confirming cancellation in MetaMask…");
    try {
      const tx = await taskManager.cancelTask(taskId);
      setCancelStatus("Transaction submitted! Waiting for confirmation…");
      await tx.wait();
      setCancelStatus("Project cancelled and escrow refunded to your wallet!");
      setTimeout(() => {
        fetchTask();
        setCancelStatus("");
      }, 3000);
    } catch (e: any) {
      console.error("Cancel task error:", e);
      setCancelStatus("Error: " + (e.reason || e.info?.error?.message || e.message || "Cancellation failed"));
      setTimeout(() => setCancelStatus(""), 5000);
    } finally {
      setCancellingTask(false);
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

              {(task.creator || task.customerAddress) && (
                <div className="flex items-center gap-2 text-xs text-base-content/50 font-mono pt-1">
                  <span>Creator:</span>
                  <span className="text-base-content font-medium truncate max-w-xs">
                    {task.creator || task.customerAddress}
                  </span>
                  {account && (task.creator || task.customerAddress)?.toLowerCase() === account.toLowerCase() && (
                    <span className="badge badge-xs badge-info font-sans font-semibold">You</span>
                  )}
                </div>
              )}

              {account && (task.creator || task.customerAddress)?.toLowerCase() === account.toLowerCase() && task.status !== "CANCELLED" && task.status !== "COMPLETED" && (
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCancelTask}
                    disabled={cancellingTask}
                    className="btn btn-outline btn-error btn-xs font-semibold"
                  >
                    {cancellingTask ? (
                      <span className="flex items-center gap-1.5">
                        <span className="loading loading-spinner loading-xs" />
                        Refunding Escrow…
                      </span>
                    ) : (
                      "Cancel Task & Refund Escrow"
                    )}
                  </button>
                  {cancelStatus && (
                    <span className="text-xs text-info font-medium">{cancelStatus}</span>
                  )}
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

      {/* ─── Master Synthesized Deliverable Solution ─── */}
      {task.solution && (
        <div className="card bg-base-100 border-2 border-primary/30 shadow-md mb-8 overflow-hidden">
          <div className="bg-primary/10 border-b border-primary/20 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-sm text-base-content uppercase tracking-wider">
                Final Synthesized Project Solution
              </h3>
            </div>
            <span className="badge badge-success font-mono font-bold text-xs gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> AI AGGREGATED
            </span>
          </div>
          <div className="p-6 md:p-8 space-y-4">
            <div className="text-sm text-base-content whitespace-pre-wrap leading-relaxed bg-base-200/50 p-6 rounded-xl border border-base-300 font-mono">
              {task.solution}
            </div>
          </div>
        </div>
      )}

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
            const workerAddr = st.worker || st.workerAddress;
            const isWorker = Boolean(account && workerAddr && account.toLowerCase() === workerAddr.toLowerCase());
            
            const isOpen = (st.state === "OPEN" || st.state === "CREATED") && !workerAddr;
            const isClaimed = st.state === "CLAIMED" || (Boolean(workerAddr) && st.state !== "VERIFIED" && st.state !== "SUBMITTED");
            const isSubmitted = st.state === "SUBMITTED";
            const isVerified = st.state === "VERIFIED";

            const stateMeta = STATE_BADGE[st.state] || (isOpen ? { label: "OPEN", cls: "badge-info" } : { label: st.state, cls: "badge-ghost" });

            return (
              <div
                key={st.subtaskId}
                className={`card bg-base-100 border border-base-300/80 shadow-xs transition-all ${
                  isVerified ? "bg-base-100/70" : ""
                }`}
              >
                <div className="card-body p-5 md:p-6 gap-4">
                  {/* Subtask Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-7 h-7 rounded-lg bg-base-200 border border-base-300 flex items-center justify-center text-xs font-mono font-bold shrink-0">
                        {index + 1}
                      </div>
                      <div className="space-y-1.5 flex-1">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-base-content/40 block">
                          {st.rangeLabel || `Phase ${index + 1}`}
                        </span>
                        <div className="text-sm font-medium text-base-content leading-relaxed bg-base-200/40 p-3 rounded-lg border border-base-300/60">
                          {st.description}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="badge badge-neutral font-mono font-bold text-xs">
                        {st.reward} MON
                      </span>
                      <span className={`badge badge-xs ${stateMeta.cls} font-mono font-bold`}>
                        {stateMeta.label}
                      </span>
                    </div>
                  </div>

                  {/* Worker Attribution (if claimed) */}
                  {workerAddr && (
                    <div className="flex items-center gap-2 text-xs text-base-content/50 font-mono bg-base-200/40 p-2.5 rounded-lg border border-base-300/60">
                      <span className="text-[11px] text-base-content/60">Worker:</span>
                      <Link
                        to={`/worker/${workerAddr}`}
                        className="text-base-content hover:underline truncate font-medium"
                      >
                        {workerAddr}
                      </Link>
                      {isWorker && (
                        <span className="badge badge-xs badge-success font-sans font-semibold ml-auto">
                          You
                        </span>
                      )}
                    </div>
                  )}

                  {/* Worker Deliverable Result Preview (if submitted or verified) */}
                  {(isSubmitted || isVerified || st.submissionContent) && (
                    <div className="space-y-2 bg-base-200/40 p-3.5 rounded-lg border border-base-300/60">
                      <div className="flex items-center justify-between text-xs font-bold text-base-content uppercase tracking-wider">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                          <span>Submitted Deliverable Result</span>
                        </span>
                        {st.qualityScore != null && (
                          <span className="badge badge-success badge-xs font-mono font-bold">
                            Score: {st.qualityScore}/100
                          </span>
                        )}
                      </div>
                      {st.submissionContent ? (
                        <div className="text-xs text-base-content/90 font-mono bg-base-100 p-3 rounded-lg border border-base-300/80 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                          {st.submissionContent}
                        </div>
                      ) : (
                        <p className="text-xs text-base-content/50 italic">
                          Deliverable securely recorded on Monad and pinned to IPFS.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Status Banner */}
                  {statusMessages[st.subtaskId] && (
                    <div role="alert" className="alert alert-info text-xs py-2">
                      <span>{statusMessages[st.subtaskId]}</span>
                    </div>
                  )}

                  {/* Verified State Feedback */}
                  {isVerified && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-success/10 border border-success/20 text-success text-xs font-medium">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>AI Verified • Payment released directly to worker</span>
                      </div>
                    </div>
                  )}

                  {/* OPEN State: Claim CTA */}
                  {isOpen && (
                    <div className="pt-2 border-t border-base-300/60 flex items-center justify-between">
                      <span className="text-xs text-base-content/50">
                        Open for any freelancer to claim
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
                          "Claim Subtask"
                        )}
                      </button>
                    </div>
                  )}

                  {/* CLAIMED State & Worker: Deliverable Submission */}
                  {isClaimed && isWorker && (
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

                  {isClaimed && !isWorker && (
                    <div className="pt-2 border-t border-base-300/60 flex items-center justify-between text-xs text-base-content/50">
                      <span>Currently in progress by claimant worker.</span>
                      <span className="badge badge-warning badge-xs font-mono">CLAIMED</span>
                    </div>
                  )}

                  {/* SUBMITTED State: AI Verification or Download */}
                  {isSubmitted && (
                    <div className="pt-2 border-t border-base-300/60 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-base-content/60">
                          Deliverable submitted to IPFS.
                        </span>
                        {(st.submissionCID || st.submissionHash || st.submissions?.[0]?.storagePath) && (
                          <button
                            type="button"
                            onClick={() => handleDownload(st.submissionCID || st.submissions?.[0]?.storagePath || st.submissionHash, st.subtaskId)}
                            disabled={downloadingId === st.subtaskId}
                            className="btn btn-ghost btn-xs text-xs gap-1"
                          >
                            <Download className="w-3 h-3" />
                            Download
                          </button>
                        )}
                      </div>

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
                Upon meeting verification criteria (score ≥ 70/100), the protocol automatically executes the release of escrowed funds directly to the worker's wallet.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetail;



