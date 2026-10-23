import "./project-details.css";
import { PageLoading, PageError } from "../components/ui/PageState";
import { ClaimTaskDialog, type ClaimPreview } from "../components/task/ClaimTaskDialog";
import { useState, useEffect } from "react";
import { SubtaskSpec, subtaskHeadline } from "../components/task/SubtaskSpec";
import { TaskAttachments } from "../components/task/AttachmentPanel";
import { useParams, Link } from "react-router-dom";
import { ethers } from "ethers";
import { useWeb3 } from "../contexts/Web3Context";
import {
  CheckCircle2,
  ArrowLeft,
  Download,
  ExternalLink,
  Send,
  ChevronDown,
} from "lucide-react";
import { API_URL, BLOCK_EXPLORER_URL, TASK_MANAGER_ADDRESS, ESCROW_ADDRESS } from "../lib/constants";
import { taskHeadline, looksLikeCid, MISSING_BRIEF_HINT, syncTaskTx } from "../lib/utils";
import { privateAccessHeaders } from "../lib/privateAccess";

const STATE_BADGE: Record<string, { label: string; cls: string }> = {
  OPEN:            { label: "OPEN", cls: "badge-info" },
  CREATED:         { label: "OPEN", cls: "badge-info" },
  CLAIMED:         { label: "CLAIMED", cls: "badge-warning" },
  SUBMITTED:       { label: "SUBMITTED", cls: "badge-secondary" },
  IN_DISPUTE:      { label: "IN DISPUTE", cls: "badge-error" },
  VERIFIED:        { label: "VERIFIED", cls: "badge-success" },
  CANCELLED:       { label: "CANCELLED", cls: "badge-ghost" },
  DISPUTED:        { label: "IN DISPUTE", cls: "badge-error" },
  FAILED:          { label: "FAILED", cls: "badge-error" },
  VERIFICATION_FAILED: { label: "VERIFICATION FAILED", cls: "badge-error" },
  REJECTED:        { label: "REJECTED", cls: "badge-error" },
};

const TaskDetail = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const { account, taskManager, connectWallet, currencySymbol, networkName } = useWeb3();
  const currency = currencySymbol || "ETH";
  const [task, setTask] = useState<any>(null);
  const taskEscrowAddress = ESCROW_ADDRESS;
  const taskContractAddress = TASK_MANAGER_ADDRESS;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submission, setSubmission] = useState("");
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimPreview, setClaimPreview] = useState<ClaimPreview | null>(null);
  const [forfeitingId, setForfeitingId] = useState<string | null>(null);
  const [disputingId, setDisputingId] = useState<string | null>(null);
  const [bondAmount, setBondAmount] = useState<bigint | null>(null);
  const [statusMessages, setStatusMessages] = useState<Record<string, string>>({});
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [cancellingTask, setCancellingTask] = useState(false);
  const [cancelStatus, setCancelStatus] = useState("");
  const [expandedSubtaskId, setExpandedSubtaskId] = useState<string | null>(null);

  useEffect(() => {
    setExpandedSubtaskId(null);
    fetchTask();
  }, [taskId, account]);

  useEffect(() => {
    if (!taskManager) return;
    taskManager.workerBondAmount().then(setBondAmount).catch(() => setBondAmount(null));
  }, [taskManager]);

  useEffect(() => {
    if (!task?.subtasks?.some((st: any) => ["SUBMITTED", "IN_DISPUTE"].includes(st.state))) return;
    const interval = setInterval(() => fetchTask(true), 5000);
    return () => clearInterval(interval);
  }, [task]);


  const fetchTask = async (quiet = false) => {
    try {
      if (!quiet) { setLoading(true); setLoadError(""); }
      const res = await fetch(`${API_URL}/api/tasks/${taskId}`, { headers: privateAccessHeaders(account) });
      if (!res.ok) throw new Error(res.status === 404 ? "This project could not be found. Check the link or return to the marketplace." : "We could not load this project. Please try again.");
      const loaded = await res.json();
      if (loaded.contractAddress?.toLowerCase() !== TASK_MANAGER_ADDRESS.toLowerCase()) throw new Error("This project is not on the active contract. Create a new project for immediate payouts.");
      setTask(loaded);
    } catch (e) {
      if (!quiet) setLoadError(e instanceof Error ? e.message : "Project unavailable. Please try again.");
    } finally {
      if (!quiet) setLoading(false);
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
    if ((task?.creator || task?.customerAddress)?.toLowerCase() === account.toLowerCase()) {
      setMsg(subtaskId, "You cannot claim your own task.");
      return;
    }
    setClaimingId(subtaskId);
    try {
      const bond = bondAmount ?? (await taskManager.workerBondAmount());
      setMsg(subtaskId, `Confirming claim + ${ethers.formatEther(bond)} ${currency} bond in MetaMask…`);
      const tx = await taskManager.claimSubtask(taskId, subtaskId, { value: bond });
      setMsg(subtaskId, "Transaction submitted! Waiting for confirmation…");
      await tx.wait();
      setMsg(subtaskId, "Claimed successfully! Refreshing state…");
      setClaimPreview(null);
      setTask((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          subtasks: (prev.subtasks || []).map((s: any) =>
            s.subtaskId.toLowerCase() === subtaskId.toLowerCase()
              ? { ...s, state: "CLAIMED", worker: account, bondAmount: ethers.formatEther(bond) }
              : s
          )
        };
      });
      await syncTaskTx(tx.hash);
      setTimeout(() => {
        fetchTask();
        clearMsg(subtaskId);
      }, 1500);
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
      setMsg(subtaskId, "Saving submission…");
      const submissionRes = await fetch(`${API_URL}/api/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...privateAccessHeaders(account) },
        body: JSON.stringify({ subtaskId, worker: account, content: submission }),
      });
      const submissionData = await submissionRes.json();
      if (!submissionRes.ok) throw new Error(submissionData.error || "Could not save submission");

      setMsg(subtaskId, "Recording submission proof on Ethereum…");
      const tx = await taskManager.recordSubmissionProof(
        taskId,
        subtaskId,
        submissionData.proofHash
      );
      setMsg(subtaskId, "Transaction submitted! Waiting for confirmation…");
      await tx.wait();
      setTask((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          subtasks: (prev.subtasks || []).map((s: any) =>
            s.subtaskId.toLowerCase() === subtaskId.toLowerCase()
              ? { ...s, state: "SUBMITTED" }
              : s
          )
        };
      });
      await syncTaskTx(tx.hash);

      setMsg(subtaskId, "Work submitted and recorded on-chain. AI verification is queued.");
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

  const handleForfeit = async (subtaskId: string) => {
    if (!window.confirm(`Are you sure you want to forfeit this task? Your ${currency} bond will be returned in full.`))
      return;
    if (!taskManager) {
      setMsg(subtaskId, "Wallet not connected. Please connect your Web3 wallet.");
      return;
    }
    setForfeitingId(subtaskId);
    try {
      setMsg(subtaskId, "Confirming forfeit on Ethereum…");
      const tx = await taskManager.forfeitClaim(taskId, subtaskId);
      setMsg(subtaskId, "Transaction submitted! Waiting for confirmation…");
      await tx.wait();
      setMsg(subtaskId, "Forfeited. Task re-opened in marketplace.");
      setTask((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          subtasks: (prev.subtasks || []).map((s: any) =>
            s.subtaskId.toLowerCase() === subtaskId.toLowerCase()
              ? { ...s, state: "CREATED", worker: null, bondAmount: null }
              : s
          )
        };
      });
      await syncTaskTx(tx.hash);
      setTimeout(() => {
        fetchTask();
        clearMsg(subtaskId);
      }, 1500);
    } catch (e: any) {
      console.error("Forfeit error:", e);
      setMsg(subtaskId, "Error: " + (e.reason || e.info?.error?.message || e.message || "Forfeit failed"));
    } finally {
      setForfeitingId(null);
    }
  };

  const handleDispute = async (subtaskId: string) => {
    if (!window.confirm("Request administrator review? The administrator will approve payment to the worker or uphold rejection and refund the creator."))
      return;
    if (!taskManager) {
      setMsg(subtaskId, "Wallet not connected. Please connect your Web3 wallet.");
      return;
    }
    setDisputingId(subtaskId);
    try {
      setMsg(subtaskId, "Raising dispute on Ethereum…");
      const tx = await taskManager.disputeTask(taskId, subtaskId);
      await tx.wait();
      setMsg(subtaskId, "Dispute raised. Your request is awaiting administrator review.");
      setTask((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          subtasks: (prev.subtasks || []).map((s: any) =>
            s.subtaskId.toLowerCase() === subtaskId.toLowerCase()
              ? { ...s, state: "IN_DISPUTE" }
              : s
          )
        };
      });
      await syncTaskTx(tx.hash);
      setTimeout(() => {
        fetchTask();
      }, 1500);
    } catch (e: any) {
      console.error("Dispute error:", e);
      setMsg(subtaskId, "Error: " + (e.reason || e.info?.error?.message || e.message || "Dispute failed"));
    } finally {
      setDisputingId(null);
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
      await syncTaskTx(tx.hash);
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

  if (loading) return <PageLoading label="Loading project workstreams…" />;
  if (!task || loadError) return <PageError title="Project unavailable" message={loadError || "This project could not be found."} onRetry={fetchTask}><Link to="/worker" className="btn btn-outline">Back to marketplace</Link></PageError>;

  const isTaskCancelled = task.status === "CANCELLED" || (task.subtasks?.length > 0 && task.subtasks.every((st: any) => st.state === "CANCELLED"));
  const verifiedCount = task.subtasks.filter((st: any) => st.state === "VERIFIED").length;
  const totalCount = task.subtasks.length;
  const progressPercent = totalCount > 0 ? (verifiedCount / totalCount) * 100 : 0;
  const totalBudget = task.subtasks
    .reduce((acc: number, st: any) => acc + Number(st.reward || 0), 0)
    .toFixed(2);

  const headline = taskHeadline(task);
  const creator = task.creator || task.customerAddress;
  const isCreator = Boolean(account && creator?.toLowerCase() === account.toLowerCase());
  const projectStatus = isTaskCancelled ? "Cancelled"
    : progressPercent === 100 ? "Completed"
    : task.subtasks.some((st: any) => ["IN_DISPUTE", "DISPUTED"].includes(st.state)) ? "In dispute"
    : task.subtasks.some((st: any) => st.state === "SUBMITTED") ? "In review" : "In progress";
  const projectStatusClass = isTaskCancelled ? "badge-ghost" : progressPercent === 100 ? "badge-success" : projectStatus === "In dispute" ? "badge-error" : "badge-info";

  return (
    <div className="task-workspace project-detail-page">
      <ClaimTaskDialog task={claimPreview} bond={bondAmount === null ? null : ethers.formatEther(bondAmount)} currency={currency} connected={Boolean(account)} busy={claimingId !== null} message={claimPreview ? statusMessages[claimPreview.subtaskId] : undefined} onClose={() => setClaimPreview(null)} onConfirm={() => { if (claimPreview) void handleClaim(claimPreview.subtaskId); }} onConnect={() => { void connectWallet(); }} />

      <Link to={isCreator ? "/creator/dashboard" : "/worker"} className="project-back"><ArrowLeft size={16} aria-hidden="true" />{isCreator ? "All projects" : "Marketplace"}</Link>
      <header className="project-overview">
        <div className="project-heading-line"><p className="eyebrow">Project</p><span className={`badge ${projectStatusClass}`}>{projectStatus}</span></div>
        <h1>{headline.text}</h1>
        {headline.isPlaceholder && <p className="project-description-hint">{MISSING_BRIEF_HINT}</p>}
        <div className="project-summary-strip">
          <div><span>{isTaskCancelled ? "Original budget" : "Project budget"}</span><strong>{totalBudget} <small>{currency}</small></strong></div>
          <div className="project-completion"><span>{verifiedCount} of {totalCount} tasks verified</span><progress aria-label="Verified project progress" className="progress progress-primary" value={verifiedCount} max={Math.max(1, totalCount)} /></div>
        </div>
      </header>

      <details className="project-disclosure">
        <summary>Project brief & files<ChevronDown size={18} aria-hidden="true" /></summary>
        <div className="project-disclosure-body">
          {task.description && !looksLikeCid(task.description) && task.description.trim() !== headline.text && <p className="project-original-brief">{task.description}</p>}
          {!!task.successCriteria?.length && <section><h2>Project requirements</h2><ul className="project-requirements">{task.successCriteria.map((criterion: string, index: number) => <li key={index}>{criterion}</li>)}</ul></section>}
          <TaskAttachments description={task.description} />
          <dl className="project-metadata"><div><dt>Project ID</dt><dd>{taskId}</dd></div>{creator && <div><dt>Created by</dt><dd><a href={`${BLOCK_EXPLORER_URL}/address/${creator}`} target="_blank" rel="noreferrer">{creator}{isCreator ? " (you)" : ""}<ExternalLink size={13} aria-hidden="true" /></a></dd></div>}</dl>
          {isCreator && task.status !== "CANCELLED" && task.status !== "COMPLETED" && <div className="project-owner-actions"><button className="btn btn-outline btn-error btn-sm" onClick={handleCancelTask} disabled={cancellingTask}>{cancellingTask ? "Cancelling..." : "Cancel project & refund escrow"}</button>{cancelStatus && <p role="status">{cancelStatus}</p>}</div>}
        </div>
      </details>

      {task.solution && <details className="project-disclosure project-result">
        <summary><span><CheckCircle2 size={18} aria-hidden="true" />Final deliverable</span><ChevronDown size={18} aria-hidden="true" /></summary>
        <div className="project-disclosure-body project-final-content">{task.solution}</div>
      </details>}

      <section className="project-task-section" aria-labelledby="project-tasks-title">
        <div className="project-section-heading"><h2 id="project-tasks-title">Tasks</h2><p>Select a task to view its requirements and actions.</p></div>
        <div className="project-task-list">
          {task.subtasks.map((st: any, index: number) => {
            const workerAddr = st.worker || st.workerAddress;
            const isWorker = Boolean(account && workerAddr && account.toLowerCase() === workerAddr.toLowerCase());
            const isOpen = (st.state === "OPEN" || st.state === "CREATED") && !workerAddr && !isTaskCancelled;
            const isClaimed = st.state === "CLAIMED";
            const isSubmitted = st.state === "SUBMITTED";
            const isDisputed = st.state === "IN_DISPUTE" || st.state === "DISPUTED";
            const isVerified = st.state === "VERIFIED";
            const stateMeta = STATE_BADGE[st.state] || (isOpen ? STATE_BADGE.OPEN : { label: st.state, cls: "badge-ghost" });
            const title = st.rangeLabel || subtaskHeadline(st);
            const expanded = expandedSubtaskId === st.subtaskId;
            const submissionPath = st.submissions?.[0]?.storagePath;
            const downloadCid = st.submissionCID || (submissionPath && !submissionPath.startsWith("supabase:") ? submissionPath : undefined);
            const hasSubmission = isSubmitted || isVerified || st.state === "VERIFICATION_FAILED" || isDisputed || st.submissionContent || downloadCid;
            return <article className={`project-task ${expanded ? "is-expanded" : ""}`} key={st.subtaskId}>
              <h3><button id={`task-toggle-${st.subtaskId}`} className="project-task-toggle" aria-expanded={expanded} aria-controls={`task-panel-${st.subtaskId}`} onClick={() => setExpandedSubtaskId(expanded ? null : st.subtaskId)}>
                <span className="project-task-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <span className="project-task-title">{title}</span>
                <span className={`project-task-status badge ${stateMeta.cls}`}>{stateMeta.label.toLowerCase().replace(/\b\w/g, (letter: string) => letter.toUpperCase())}</span>
                <span className="project-task-reward">{st.reward} <small>{currency}</small></span>
                <ChevronDown className="project-task-chevron" size={18} aria-hidden="true" />
              </button></h3>
              <div id={`task-panel-${st.subtaskId}`} role="region" aria-labelledby={`task-toggle-${st.subtaskId}`} hidden={!expanded} className="project-task-panel">
                <SubtaskSpec subtask={st} showHeadline={title.trim() !== subtaskHeadline(st).trim()} showVerificationHint={false} />
                {workerAddr && <p className="project-worker">Contributor <Link to={`/worker/${workerAddr}`}>{isWorker ? "You" : `${workerAddr.slice(0, 6)}...${workerAddr.slice(-4)}`}</Link></p>}

                {hasSubmission && <section className="task-delivery"><div className="task-delivery-heading"><h4>Deliverable</h4>{st.qualityScore != null && <span>Score {st.qualityScore}/100</span>}{downloadCid && <button className="btn btn-ghost btn-sm" onClick={() => handleDownload(downloadCid, st.subtaskId)} disabled={downloadingId === st.subtaskId}><Download size={15} aria-hidden="true" />{downloadingId === st.subtaskId ? "Downloading..." : "Download"}</button>}</div>{st.submissionContent ? <div className="task-delivery-content">{st.submissionContent}</div> : <p>The preview is unavailable. {downloadCid ? "Download the submitted file to review it." : "Submission recorded on-chain."}</p>}</section>}
                {statusMessages[st.subtaskId] && <div role="status" className="alert alert-info">{statusMessages[st.subtaskId]}</div>}

                {isOpen && <div className="project-task-actions">{isCreator ? <p>You cannot claim your own task.</p> : <p>Check the scope and claim bond before continuing.</p>}<button className="btn btn-primary" onClick={() => { clearMsg(st.subtaskId); setClaimPreview(st); }} disabled={isCreator || claimingId === st.subtaskId}>{claimingId === st.subtaskId ? "Claiming..." : "Review & claim"}</button></div>}
                {isClaimed && isWorker && <section className="task-submit"><label htmlFor={`submission-${st.subtaskId}`}>Your deliverable</label><textarea id={`submission-${st.subtaskId}`} rows={5} placeholder="Paste your final deliverable here..." className="textarea textarea-bordered w-full" value={submission} onChange={e => setSubmission(e.target.value)} disabled={submittingId === st.subtaskId} /><div className="project-task-actions"><button className="btn btn-ghost text-error" onClick={() => handleForfeit(st.subtaskId)} disabled={forfeitingId === st.subtaskId}>{forfeitingId === st.subtaskId ? "Forfeiting..." : "Forfeit task"}</button><button className="btn btn-primary" onClick={() => handleSubmit(st.subtaskId)} disabled={submittingId === st.subtaskId || !submission.trim()}><Send size={16} aria-hidden="true" />{submittingId === st.subtaskId ? "Submitting..." : "Submit deliverable"}</button></div></section>}
                {isSubmitted && <p className="task-settlement">Submission recorded. The orchestrator is checking it against the acceptance criteria.</p>}
                {isVerified && <p className="task-settlement"><CheckCircle2 size={16} aria-hidden="true" />Reward paid and bond returned. <a href={st.payoutTxHash ? `${BLOCK_EXPLORER_URL}/tx/${st.payoutTxHash}` : `${BLOCK_EXPLORER_URL}/address/${taskEscrowAddress}`} target="_blank" rel="noreferrer">{st.payoutTxHash ? "View payment" : "View escrow"}<ExternalLink size={13} aria-hidden="true" /></a></p>}
                {st.state === "CANCELLED" && <p className="task-settlement">Escrow refunded to the creator.</p>}
                {st.state === "VERIFICATION_FAILED" && <div className="project-task-actions"><p>Verification did not pass. The reward and bond remain held for a worker appeal.</p>{isWorker && <button className="btn btn-outline btn-error" onClick={() => handleDispute(st.subtaskId)} disabled={disputingId === st.subtaskId}>{disputingId === st.subtaskId ? "Raising dispute..." : "Dispute verification"}</button>}</div>}
                {isDisputed && <p className="task-settlement">Awaiting administrator resolution. Funds and bond remain locked.</p>}
              </div>
            </article>;
          })}
        </div>
        {!totalCount && <div className="workspace-empty"><h3>No tasks yet</h3><p>The task plan will appear here when it has been indexed.</p></div>}
      </section>

      <details className="project-disclosure project-records">
        <summary>Transaction records<span className="project-network">{networkName || "Ethereum"}</span><ChevronDown size={18} aria-hidden="true" /></summary>
        <div className="project-disclosure-body"><div className="project-record-link"><span>{task.txHash ? "Project creation" : "Task manager contract"}</span><a href={task.txHash ? `${BLOCK_EXPLORER_URL}/tx/${task.txHash}` : `${BLOCK_EXPLORER_URL}/address/${taskContractAddress}`} target="_blank" rel="noreferrer">View on explorer<ExternalLink size={14} aria-hidden="true" /></a></div><div className="project-record-link"><span>Escrow contract</span><a href={`${BLOCK_EXPLORER_URL}/address/${taskEscrowAddress}`} target="_blank" rel="noreferrer">View on explorer<ExternalLink size={14} aria-hidden="true" /></a></div></div>
      </details>
      <p className="project-help">Approval releases the reward and returns the claim bond. <Link to="/security">How verification works<ExternalLink size={13} aria-hidden="true" /></Link></p>
    </div>
  );
};

export default TaskDetail;
