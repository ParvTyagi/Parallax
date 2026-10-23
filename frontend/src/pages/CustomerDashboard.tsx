import { PageLoading } from "../components/ui/PageState";
import { useState, useEffect, useMemo, useRef, type ComponentProps } from "react";
import { useWeb3 } from "../contexts/Web3Context";
import { ethers } from "ethers";
import { API_URL, ETH_CHAIN_ID } from "../lib/constants";
import { taskHeadline, MISSING_BRIEF_HINT, syncTaskTx } from "../lib/utils";
import { privateAccessHeaders } from "../lib/privateAccess";
import { Link } from "react-router-dom";
import { ReviewSubtasksModal, type DraftSubtask } from "../components/task/ReviewSubtasksModal";
import {
  AttachmentUploader,
  formatBytes,
  type UploadedAttachment,
} from "../components/task/AttachmentUploader";
import {
  Layers,
  Coins,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Search,
  ArrowUpRight,
} from "lucide-react";

type ReviewedPlan = { masterTaskCID: string; finalSubtasks: DraftSubtask[] };
type CreationAttempt = { plan: ReviewedPlan; account: string; txHash?: string; confirmed?: boolean };

function deriveTaskStatus(subtasks: any[], taskStatus?: string): { label: string; cls: string; dot: string } {
  if (
    taskStatus === "CANCELLED" ||
    (subtasks && subtasks.length > 0 && subtasks.every((s) => s.state === "CANCELLED"))
  ) {
    return { label: "Cancelled", cls: "badge-ghost text-base-content/60", dot: "bg-base-content/40" };
  }
  if (!subtasks || subtasks.length === 0) return { label: "Draft", cls: "badge-ghost", dot: "bg-base-300" };
  if (subtasks.some((s) => s.state === "VERIFICATION_FAILED")) return { label: "Verification failed", cls: "badge-error", dot: "bg-error" };
  if (subtasks.some((s) => s.state === "IN_DISPUTE")) return { label: "In Dispute", cls: "badge-error", dot: "bg-error" };
  if (subtasks.every((s) => s.state === "VERIFIED")) return { label: "Completed", cls: "badge-success", dot: "bg-success" };
  if (subtasks.some((s) => s.state === "SUBMITTED")) return { label: "In Review", cls: "badge-info", dot: "bg-info" };
  return { label: "Active", cls: "badge-neutral", dot: "bg-primary" };
}

const CustomerDashboard = () => {
  const { account, balance, taskManager, provider, connectWallet, currencySymbol, networkName } = useWeb3();
  const currency = currencySymbol || "MON";
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [errorText, setErrorText] = useState("");
  const [attachment, setAttachment] = useState<UploadedAttachment | null>(null);
  const [activeTab, setActiveTab] = useState<"create" | "tasks">("create");

  const DESCRIPTION_MAX = 2000;
  const DESCRIPTION_ADVISORY_MIN = 80;

  const budgetNum = Number(budget);
  const balanceNum = balance === null ? null : Number(balance);

  const validation = useMemo(() => {
    if (!description.trim()) return { ok: false, reason: "Add a job description first." };
    if (!budget.trim()) return { ok: false, reason: `Set a budget in ${currency}.` };
    if (!Number.isFinite(budgetNum) || budgetNum <= 0) {
      return { ok: false, reason: `Budget must be greater than 0 ${currency}.` };
    }
    return { ok: true, reason: "" };
  }, [description, budget, budgetNum, currency]);

  const overBalance = balanceNum !== null && budgetNum > 0 && budgetNum > balanceNum;
  const briefIsThin =
    description.trim().length > 0 && description.trim().length < DESCRIPTION_ADVISORY_MIN;

  const perSubtask =
    budgetNum > 0
      ? { high: budgetNum / 3, low: budgetNum / 5 }
      : null;

  const tabRefs = useRef<Partial<Record<"create" | "tasks", HTMLButtonElement | null>>>({});

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const order = ["create", "tasks"] as const;
    const i = order.indexOf(activeTab);
    const next =
      e.key === "ArrowRight" ? order[(i + 1) % order.length]
      : e.key === "ArrowLeft" ? order[(i - 1 + order.length) % order.length]
      : e.key === "Home" ? order[0]
      : e.key === "End" ? order[order.length - 1]
      : null;
    if (!next) return;
    e.preventDefault();
    setActiveTab(next);
    tabRefs.current[next]?.focus();
  };

  const [searchFilter, setSearchFilter] = useState("");
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState("");

  const [draftDecomposition, setDraftDecomposition] = useState<{
    masterTask: string;
    masterTaskCID: string;
    masterObjective?: string;
    successCriteria?: string[];
    subtasks: ComponentProps<typeof ReviewSubtasksModal>["subtasks"];
  } | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [draftBudget, setDraftBudget] = useState("");
  const [draftAccount, setDraftAccount] = useState("");
  const [creationAttempt, setCreationAttempt] = useState<CreationAttempt | null>(null);
  const creationInFlight = useRef(false);
  const hasSubmittedTransaction = Boolean(creationAttempt?.txHash);
  const ownsDraft = Boolean(account && account.toLowerCase() === draftAccount.toLowerCase());

  useEffect(() => {
    setMyTasks([]); setTasksError("");
    if (account) { setTasksLoading(true); void fetchCustomerTasks(account); }
    else setTasksLoading(false);
  }, [account]);

  useEffect(() => {
    if (!account) return;
    const interval = setInterval(() => fetchCustomerTasks(account), 5000);
    return () => clearInterval(interval);
  }, [account]);

  const fetchCustomerTasks = async (walletAddress: string) => {
    try {
      const res = await fetch(`${API_URL}/api/tasks/customer/${walletAddress}`, { headers: privateAccessHeaders(walletAddress) });
      if (!res.ok) throw new Error("Could not load your projects. Please try again.");
      setMyTasks(await res.json()); setTasksError("");
    } catch (e) {
      setTasksError(e instanceof Error ? e.message : "Could not load your projects.");
    } finally { setTasksLoading(false); }
  };


  const waitForIndexedTask = async (walletAddress: string, previousCount: number) => {
    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        const res = await fetch(`${API_URL}/api/tasks/customer/${walletAddress}`, { headers: privateAccessHeaders(walletAddress) });
        if (res.ok) {
          const tasks = await res.json();
          if (Array.isArray(tasks) && tasks.length > previousCount) {
            setMyTasks(tasks);
            return true;
          }
        }
      } catch {
        // Keep retrying
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    return false;
  };

  const handleDecompose = async () => {
    if (creationInFlight.current || hasSubmittedTransaction) return;
    if (!account) {
      await connectWallet();
      return;
    }
    if (!validation.ok) {
      setErrorText(validation.reason);
      return;
    }
    setIsProcessing(true);
    setErrorText("");
    try {
      let finalDescription = description.trim();

      if (attachment) {
        const detail = attachment.isArchive && attachment.entryCount
          ? `${attachment.filename} (${attachment.entryCount} files, ${formatBytes(attachment.size)})`
          : `${attachment.filename} (${formatBytes(attachment.size)})`;
        finalDescription += `\n\nAttached Dataset: ${detail} - ipfs://${attachment.cid}`;
      }

      setStatusText("Pinning task specification to IPFS…");
      const ipfsRes = await fetch(`${API_URL}/api/ipfs/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: finalDescription }),
      });
      const ipfsData = await ipfsRes.json();
      if (!ipfsRes.ok) throw new Error(ipfsData.error || "IPFS upload failed");

      setStatusText("Decomposing task with Gemini AI…");
      const res = await fetch(`${API_URL}/api/decompose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descriptionCID: ipfsData.cid, budget }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI Decomposition failed");

      setDraftBudget(budget);
      setDraftAccount(account);
      setCreationAttempt(null);
      setDraftDecomposition({
        masterTask: data.masterTask,
        masterTaskCID: data.masterTaskCID,
        masterObjective: data.masterObjective,
        successCriteria: data.successCriteria,
        subtasks: data.subtasks,
      });
      setIsReviewOpen(true);
      setIsProcessing(false);
      setStatusText("");
    } catch (error: any) {
      console.error("Task creation error:", error);
      const friendlyError =
        error?.reason ||
        error?.info?.error?.message ||
        error?.data?.message ||
        error?.message ||
        "Transaction failed. Check your wallet balance and network.";
      setErrorText(friendlyError);
      setIsProcessing(false);
      setStatusText("");
    }
  };

  const saveReviewedPlan = (plan: ReviewedPlan) => {
    setDraftDecomposition((draft) => draft ? {
      ...draft, masterTaskCID: plan.masterTaskCID, subtasks: plan.finalSubtasks,
    } : draft);
  };

  const handleConfirmCreateTask = async (result: ReviewedPlan) => {
    if (creationInFlight.current) return;
    if (!account || !ownsDraft) {
      setErrorText("Reconnect the wallet used to generate this plan before funding it.");
      return;
    }
    creationInFlight.current = true;
    setIsReviewOpen(false);
    setIsProcessing(true);
    setErrorText("");
    let attempt: CreationAttempt = creationAttempt?.txHash
      ? creationAttempt
      : { plan: result, account };
    const saveAttempt = (next: CreationAttempt) => {
      attempt = next;
      setCreationAttempt(next);
      saveReviewedPlan(next.plan);
    };
    saveAttempt(attempt);

    try {
      if (!taskManager || !provider) throw new Error("Connect your wallet to fund escrow.");
      const network = await provider.getNetwork();
      if (network.chainId !== BigInt(ETH_CHAIN_ID)) {
        throw new Error("Switch your wallet to the project network before continuing.");
      }

      let receipt: ethers.TransactionReceipt | null = null;
      if (attempt.txHash && !attempt.confirmed) {
        setStatusText("Checking the submitted transaction...");
        receipt = await provider.getTransactionReceipt(attempt.txHash);
        if (!receipt) {
          throw new Error("The submitted transaction is not confirmed yet. Check its status again before sending another transaction.");
        }
      } else if (!attempt.confirmed) {
        setStatusText("Pinning edited subtask specs to IPFS...");
        const resolvedSubtasks: DraftSubtask[] = [];
        for (const st of attempt.plan.finalSubtasks) {
          if (!st.isEdited && st.descriptionCID) {
            resolvedSubtasks.push(st);
            continue;
          }
          const pinRes = await fetch(API_URL + "/api/decompose/respec", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              rangeLabel: st.rangeLabel,
              objective: st.objective,
              contextNotes: st.contextNotes,
              acceptanceCriteria: st.acceptanceCriteria.filter((c) => c.trim()),
              deliverableFormat: st.deliverableFormat,
              skills: st.skills,
              estimatedMinutes: st.estimatedMinutes,
              reward: Number(st.reward),
              leaseDuration: st.leaseDuration,
            }),
          });
          const pinData = await pinRes.json();
          if (!pinRes.ok) throw new Error(pinData.error || "Failed to pin subtask spec");
          resolvedSubtasks.push({ ...st, descriptionCID: pinData.cid, isEdited: false });
          // Keep successfully pinned edits even if a later upload or wallet request fails.
          saveAttempt({ ...attempt, plan: { ...attempt.plan, finalSubtasks: [
            ...resolvedSubtasks, ...attempt.plan.finalSubtasks.slice(resolvedSubtasks.length),
          ] } });
        }
        saveAttempt({ ...attempt, plan: { ...attempt.plan, finalSubtasks: resolvedSubtasks } });
        const subtaskInputs = resolvedSubtasks.map((st, i) => ({
          rangeLabel: st.rangeLabel || "Subtask " + (i + 1),
          description: st.descriptionCID,
          reward: ethers.parseEther(st.reward),
          leaseDuration: BigInt(st.leaseDuration),
        }));
        const totalBudgetWei = subtaskInputs.reduce((acc, st) => acc + st.reward, 0n);
        setStatusText("Waiting for wallet signature...");
        const tx = await taskManager.createTask(
          attempt.plan.masterTaskCID, subtaskInputs, { value: totalBudgetWei }
        );
        // Save the hash before waiting: a timeout is not proof the transaction failed.
        saveAttempt({ ...attempt, txHash: tx.hash });
        setStatusText("Confirming transaction on " + networkName + "...");
        try {
          receipt = await tx.wait();
        } catch (error: any) {
          if (error?.code !== "TRANSACTION_REPLACED" || !error.receipt) throw error;
          if (error.cancelled) {
            saveAttempt({ ...attempt, txHash: undefined });
            throw new Error("The transaction was cancelled or replaced in your wallet. Your plan is ready to retry.");
          }
          receipt = error.receipt;
          saveAttempt({ ...attempt, txHash: error.receipt.hash });
        }
      }

      if (!attempt.confirmed) {
        if (!receipt) throw new Error("Confirmation is unavailable. Check transaction status again.");
        if (receipt.status !== 1) {
          saveAttempt({ ...attempt, txHash: undefined });
          throw new Error("The transaction reverted. Your plan is saved and you can retry funding.");
        }
        saveAttempt({ ...attempt, txHash: receipt.hash, confirmed: true });
      }

      setStatusText("Updating your project list...");
      const synced = await syncTaskTx(attempt.txHash!);
      const indexed = synced || await waitForIndexedTask(attempt.account, myTasks.length);
      if (!indexed) {
        throw new Error("Funding succeeded, but the project list is still updating. Retry updating the project list; no new payment is needed.");
      }
      await fetchCustomerTasks(attempt.account);
      setDescription("");
      setBudget("");
      setAttachment(null);
      setDraftDecomposition(null);
      setCreationAttempt(null);
      setActiveTab("tasks");
    } catch (error: any) {
      if (error?.receipt?.status === 0) {
        saveAttempt({ ...attempt, txHash: undefined, confirmed: false });
      } else if (!attempt.txHash && (error?.transactionHash || error?.receipt?.hash)) {
        saveAttempt({ ...attempt, txHash: error.transactionHash || error.receipt.hash });
      }
      console.error("Confirm create task error:", error);
      setErrorText(error?.reason || error?.info?.error?.message || error?.data?.message || error?.message || "Transaction failed. Your plan is ready to retry.");
    } finally {
      creationInFlight.current = false;
      setIsProcessing(false);
      setStatusText("");
    }
  };

  const handleCancelReview = (rows?: DraftSubtask[]) => {
    if (rows && draftDecomposition) {
      saveReviewedPlan({ masterTaskCID: draftDecomposition.masterTaskCID, finalSubtasks: rows });
      // A cancelled review may contain new edits: reopen review before sending.
      if (!creationAttempt?.txHash) setCreationAttempt(null);
    }
    setIsReviewOpen(false);
  };

  const filteredTasks = useMemo(() => {
    if (!searchFilter.trim()) return myTasks;
    const q = searchFilter.toLowerCase();
    return myTasks.filter((t) => {
      const headline = taskHeadline(t).text.toLowerCase();
      const desc = (t.description || "").toLowerCase();
      const obj = (t.objective || "").toLowerCase();
      return headline.includes(q) || desc.includes(q) || obj.includes(q);
    });
  }, [myTasks, searchFilter]);

  const isCancelled = (t: any) =>
    t.status === "CANCELLED" ||
    (t.subtasks && t.subtasks.length > 0 && t.subtasks.every((st: any) => st.state === "CANCELLED"));

  const isCompleted = (t: any) =>
    t.status !== "CANCELLED" &&
    t.subtasks?.length > 0 &&
    t.subtasks.every((st: any) => st.state === "VERIFIED");

  const activeCount = myTasks.filter((t) => !isCancelled(t) && !isCompleted(t)).length;
  const completedCount = myTasks.filter((t) => isCompleted(t)).length;
  const totalEscrowedETH = myTasks
    .filter((t) => !isCancelled(t))
    .reduce((acc, t) => acc + Number(t.budget || 0), 0)
    .toFixed(2);

  return (
    <div className="customer-workspace animate-in fade-in duration-300 pb-12">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <p className="eyebrow mb-2">Project studio</p>
          <h1 className="text-2xl font-bold tracking-tight text-base-content">
            Client Workspace
          </h1>
          <p className="text-sm text-base-content/60 mt-0.5">
            Turn a clear brief into independent tasks. Review the plan, then fund your project.
          </p>
        </div>

        {activeTab === "tasks" && (
          <button
            onClick={() => setActiveTab("create")}
            className="btn btn-neutral btn-sm font-semibold gap-1.5 self-start sm:self-auto"
          >
            <Sparkles aria-hidden="true" className="w-3.5 h-3.5" />
            New Project
          </button>
        )}
      </div>

      {/* ─── Tabs Bar ─── */}
      <div role="tablist" aria-label="Client workspace" className="flex border-b border-base-300 mb-8 gap-8">
        <button
          role="tab"
          id="tab-create"
          aria-selected={activeTab === "create"}
          aria-controls="panel-create"
          tabIndex={activeTab === "create" ? 0 : -1}
          ref={(el) => {
            tabRefs.current.create = el;
          }}
          onKeyDown={handleTabKeyDown}
          onClick={() => setActiveTab("create")}
          className={`pb-3 text-sm font-semibold transition-all relative ${
            activeTab === "create"
              ? "text-base-content font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
              : "text-base-content/60 hover:text-base-content"
          }`}
        >
          Post a Project
        </button>
        <button
          role="tab"
          id="tab-tasks"
          aria-selected={activeTab === "tasks"}
          aria-controls="panel-tasks"
          tabIndex={activeTab === "tasks" ? 0 : -1}
          ref={(el) => {
            tabRefs.current.tasks = el;
          }}
          onKeyDown={handleTabKeyDown}
          onClick={() => setActiveTab("tasks")}
          className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 ${
            activeTab === "tasks"
              ? "text-base-content font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
              : "text-base-content/60 hover:text-base-content"
          }`}
        >
          <span>My Projects</span>
          <span className="badge badge-sm badge-neutral font-mono text-xs">
            {myTasks.length}
          </span>
          <span className="sr-only">projects</span>
        </button>
      </div>

      {/* ─── POST A PROJECT TAB (CLEAN, FOCUSED FORM) ─── */}
      {activeTab === "create" && (
        <div
          role="tabpanel"
          id="panel-create"
          aria-labelledby="tab-create"
          className="workspace-compose"
        >
          <aside className="project-guide">
            <p className="eyebrow">From brief to delivery</p>
            <h2>A clear path to done.</h2>
            <ol className="project-steps">
              <li><span>01</span><div><strong>Define the outcome</strong><p>Describe the deliverable, your constraints, and what success looks like.</p></div></li>
              <li><span>02</span><div><strong>Review your plan</strong><p>Check the proposed tasks, acceptance criteria, and budget allocation.</p></div></li>
              <li><span>03</span><div><strong>Fund and follow progress</strong><p>Confirm with your wallet and track each task through verification.</p></div></li>
            </ol>
            <div className="brief-tip"><strong>Start with the deliverable.</strong><p>A specific output and measurable criteria help workers understand exactly what you need.</p></div>
          </aside>
          <div className="project-form card bg-base-100 border border-base-300/80 shadow-xs">
            <div className="card-body p-6 md:p-8 space-y-6">
              <div>
                <h2 className="text-base font-bold text-base-content">Project brief</h2>
                <p className="text-xs text-base-content/60 mt-0.5">
                  Tell us what you need. You can edit every task before committing your budget.
                </p>
              </div>

              {/* Job Description */}
              <div className="space-y-1.5">
                <label
                  htmlFor="task-description"
                  className="text-xs font-bold text-base-content uppercase tracking-wider flex flex-wrap gap-2 justify-between"
                >
                  <span>Job Description (required)</span>
                  <span
                    className={`font-mono text-[11px] font-normal ${
                      description.length >= DESCRIPTION_MAX
                        ? "text-error"
                        : description.length > DESCRIPTION_MAX * 0.9
                          ? "text-warning"
                          : "text-base-content/60"
                    }`}
                  >
                    {description.length} / {DESCRIPTION_MAX}
                  </span>
                </label>
                <textarea
                  id="task-description"
                  required
                  aria-describedby="task-description-hint"
                  rows={5}
                  className="textarea textarea-bordered w-full text-sm leading-relaxed focus:textarea-primary"
                  placeholder="e.g. Conduct a comprehensive security and architecture analysis of the top 5 DeFi lending protocols on Monad testnet. Provide an executive summary and comparative risk matrix in Markdown..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isProcessing}
                  maxLength={DESCRIPTION_MAX}
                />
                <p id="task-description-hint" className="sr-only">
                  Describe the work you want done. The orchestrator splits this into independent subtasks. Maximum {DESCRIPTION_MAX} characters.
                </p>

                {description.length >= DESCRIPTION_MAX && (
                  <p className="text-[11px] text-error">
                    Character limit reached. Trim the brief or attach a spec file.
                  </p>
                )}

                {briefIsThin && (
                  <p className="text-[11px] text-warning flex items-start gap-1.5">
                    <AlertCircle aria-hidden="true" className="w-3.5 h-3.5 shrink-0 mt-px" />
                    <span>
                      This brief is short. Clear scope and deliverables ensure better subtask breakdown.
                    </span>
                  </p>
                )}
              </div>

              {/* Budget */}
              <div className="space-y-1.5">
                <label
                  htmlFor="task-budget"
                  className="text-xs font-bold text-base-content uppercase tracking-wider"
                >
                  Budget in {currency} (required)
                </label>
                <div className="join w-full max-w-xs">
                  <span className="join-item inline-flex items-center px-4 bg-base-200 border border-base-300 font-mono font-bold text-xs">
                    {currency}
                  </span>
                  <input
                    id="task-budget"
                    type="number"
                    required
                    min="0.001"
                    step="0.001"
                    placeholder="0.00"
                    aria-describedby="task-budget-hint"
                    className="input input-sm input-bordered join-item w-full font-mono text-sm"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    disabled={isProcessing}
                  />
                </div>
                <p id="task-budget-hint" className="text-[11px] text-base-content/60">
                  Escrowed on Monad testnet & split across generated subtasks. Workers post an {currency} claim bond.
                </p>

                {perSubtask && (
                  <p className="text-[11px] text-base-content/60 font-mono">
                    ≈ 3–5 subtasks · roughly {perSubtask.low.toFixed(4)}–{perSubtask.high.toFixed(4)}{" "}
                    {currency} each
                  </p>
                )}

                {overBalance && (
                  <p className="text-[11px] text-warning flex items-start gap-1.5">
                    <AlertCircle aria-hidden="true" className="w-3.5 h-3.5 shrink-0 mt-px" />
                    <span>
                      This is more than your {balance} {currency} balance. The escrow transaction will fail at signing.
                    </span>
                  </p>
                )}
              </div>

              {/* Attachments */}
              <div className="space-y-1.5 pt-2 border-t border-base-300/60">
                <label className="text-xs font-bold text-base-content uppercase tracking-wider">
                  Attach Dataset / Spec Files (optional)
                </label>
                <p className="text-[11px] text-base-content/60">
                  Upload files or folders. Pinned directly to IPFS for workers to inspect.
                </p>
                <AttachmentUploader
                  attachment={attachment}
                  onChange={setAttachment}
                  disabled={isProcessing}
                />
              </div>

              {/* Error Banner */}
              {errorText && (
                <div role="alert" className="alert alert-error text-xs py-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{errorText}</span>
                </div>
              )}

              {/* Screen reader status */}
              <p role="status" aria-live="polite" className="sr-only">
                {isProcessing ? statusText || "Working…" : ""}
              </p>

              {/* AI Decomposition Review Modal */}
              {draftDecomposition && (
                <ReviewSubtasksModal
                  open={isReviewOpen}
                  masterTask={draftDecomposition.masterTask}
                  masterTaskCID={draftDecomposition.masterTaskCID}
                  masterObjective={draftDecomposition.masterObjective}
                  successCriteria={draftDecomposition.successCriteria}
                  budget={draftBudget}
                  subtasks={draftDecomposition.subtasks}
                  onConfirm={handleConfirmCreateTask}
                  onCancel={handleCancelReview}
                />
              )}

              {draftDecomposition && !isProcessing && (
                <div className="rounded-lg border border-base-300 p-3 space-y-3">
                  <p className="text-sm">
                    {creationAttempt?.confirmed
                      ? "Your project is funded. Update the project list to finish."
                      : hasSubmittedTransaction
                        ? "Your transaction was submitted. Check its status before trying again."
                        : "Your generated subtasks and edits are kept on this page. Continue without running AI decomposition again."}
                  </p>
                  {!ownsDraft && <p className="text-xs">Reconnect {draftAccount} to continue this plan.</p>}
                  {creationAttempt?.txHash && <p className="text-xs break-all">Transaction: {creationAttempt.txHash}</p>}
                  <div className="flex flex-wrap gap-2">
                    {!hasSubmittedTransaction && (
                      <button type="button" className="btn btn-outline btn-sm" disabled={!ownsDraft}
                        onClick={() => { setErrorText(""); setIsReviewOpen(true); }}>
                        Review saved plan
                      </button>
                    )}
                    {creationAttempt && (
                      <button type="button" className="btn btn-neutral btn-sm" disabled={!ownsDraft}
                        onClick={() => void handleConfirmCreateTask(creationAttempt.plan)}>
                        {creationAttempt.confirmed ? "Update project list" : hasSubmittedTransaction ? "Check transaction status" : "Retry transaction"}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Submit CTA */}
              <div className="pt-2 border-t border-base-300/60 space-y-2">
                <button
                  onClick={handleDecompose}
                  disabled={isProcessing || hasSubmittedTransaction}
                  aria-describedby={!validation.ok && account ? "submit-blocked-reason" : undefined}
                  className="btn btn-neutral btn-block font-bold text-sm shadow-xs"
                >
                  {isProcessing ? (
                    <span className="flex items-center gap-2">
                      <span className="loading loading-spinner loading-xs" aria-hidden="true" />
                      {statusText || "Decomposing & funding escrow…"}
                    </span>
                  ) : account ? (
                    <span className="flex items-center gap-2">
                      Request AI Decomposition
                      <ArrowRight aria-hidden="true" className="w-4 h-4" />
                    </span>
                  ) : (
                    "Connect Wallet to Post"
                  )}
                </button>

                {!validation.ok && account && !isProcessing && (
                  <p
                    id="submit-blocked-reason"
                    className="text-[11px] text-base-content/60 text-center"
                  >
                    {validation.reason}
                  </p>
                )}

                {validation.ok && !isProcessing && account && (
                  <p className="text-[11px] text-base-content/60 text-center">
                    Nothing is spent yet — you review and adjust every subtask before any {currency} is escrowed.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MY PROJECTS TAB (CLEAN, SCANNABLE TABLE) ─── */}
      {activeTab === "tasks" && (
        <div role="tabpanel" id="panel-tasks" aria-labelledby="tab-tasks" className="space-y-6">
          {tasksError && <div className="alert alert-error" role="alert"><span>{tasksError}</span><button className="btn btn-sm" onClick={() => { if (account) void fetchCustomerTasks(account); }}>Retry</button></div>}
          {/* Subtle KPI Summary Bar */}
          {account && myTasks.length > 0 && (
            <div className="customer-stats grid grid-cols-3 divide-x divide-base-300/80 rounded-xl border border-base-300/80 bg-base-100 shadow-xs mb-6">
              <div className="p-4 sm:p-5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-base-content/60">
                  Escrowed
                </div>
                <div className="mt-1 font-mono text-xl sm:text-2xl font-bold text-base-content">
                  {totalEscrowedETH} <span className="text-xs font-sans text-base-content/60">{currency}</span>
                </div>
              </div>
              <div className="p-4 sm:p-5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-base-content/60">
                  Active Projects
                </div>
                <div className="mt-1 font-mono text-xl sm:text-2xl font-bold text-base-content">
                  {activeCount}
                </div>
              </div>
              <div className="p-4 sm:p-5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-base-content/60">
                  Completed
                </div>
                <div className="mt-1 font-mono text-xl sm:text-2xl font-bold text-success">
                  {completedCount}
                </div>
              </div>
            </div>
          )}

          {/* Search Filter Bar */}
          {myTasks.length > 0 && (
            <div className="flex justify-between items-center gap-4">
              <div className="relative max-w-sm w-full">
                <Search
                  aria-hidden="true"
                  className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/60"
                />
                <input
                  type="search"
                  placeholder="Filter projects…"
                  aria-label="Filter your projects by description"
                  className="input input-sm input-bordered w-full pl-9 text-xs"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
              </div>
            </div>
          )}

          {!account ? (
            <div className="card bg-base-100 border border-base-300/80 p-12 text-center max-w-md mx-auto">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-full bg-base-200 flex items-center justify-center mx-auto text-base-content/60">
                  <Coins className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-base-content">Connect Wallet</h3>
                <p className="text-xs text-base-content/60 leading-relaxed">
                  Connect your Web3 wallet to manage your project escrows on Monad testnet.
                </p>
                <button onClick={connectWallet} className="btn btn-neutral btn-sm font-semibold">
                  Connect Wallet
                </button>
              </div>
            </div>
          ) : tasksLoading ? <PageLoading label="Loading your projects..." /> : tasksError && !myTasks.length ? <div className="workspace-empty"><h3>Projects are unavailable</h3><p>Retry above to load the latest project information.</p></div> : filteredTasks.length === 0 ? (
            <div className="card bg-base-100 border border-base-300/80 p-12 text-center max-w-md mx-auto">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-full bg-base-200 flex items-center justify-center mx-auto text-base-content/60">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-base-content">No projects found</h3>
                  <p className="text-xs text-base-content/60 mt-1">
                    {searchFilter
                      ? "No projects match your filter query."
                      : "You haven't posted any projects yet."}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSearchFilter("");
                    if (!searchFilter) setActiveTab("create");
                  }}
                  className="btn btn-neutral btn-sm font-semibold"
                >
                  {searchFilter ? "Clear search" : "Create Your First Project"}
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-base-300/80 bg-base-100 shadow-xs">
              <table className="responsive-records w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-base-300/80 bg-base-200/50 text-[11px] uppercase tracking-wider text-base-content/60">
                    <th className="px-5 py-3 font-semibold">Project</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Subtasks</th>
                    <th className="px-4 py-3 font-semibold">Escrow</th>
                    <th className="px-4 py-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-base-300/60">
                  {filteredTasks.map((task) => {
                    const verifiedCount = task.subtasks?.filter(
                      (st: any) => st.state === "VERIFIED"
                    ).length || 0;
                    const totalCount = task.subtasks?.length || 0;
                    const pct = totalCount > 0 ? (verifiedCount / totalCount) * 100 : 0;
                    const headline = taskHeadline(task);
                    const isTaskCancelled = isCancelled(task);
                    const status = deriveTaskStatus(task.subtasks, task.status);

                    return (
                      <tr key={task.taskId} className="hover:bg-base-200/40 transition-colors group">
                        <td className="px-5 py-4 max-w-xs md:max-w-md">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-[10px] text-base-content/60 uppercase">
                              #{task.taskId?.slice(0, 8)}
                            </span>
                          </div>
                          <Link
                            to={`/task/${task.taskId}`}
                            className={`text-sm font-semibold line-clamp-1 group-hover:text-primary transition-colors ${
                              headline.isPlaceholder
                                ? "italic font-normal text-base-content/60"
                                : "text-base-content"
                            }`}
                            title={headline.isPlaceholder ? MISSING_BRIEF_HINT : undefined}
                          >
                            {headline.text}
                          </Link>
                        </td>

                        <td data-label="Status" className="px-4 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-xs text-base-content/80 font-medium">
                            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                            {status.label}
                          </span>
                        </td>

                        <td data-label="Delivery" className="px-4 py-4 whitespace-nowrap">
                          {isTaskCancelled ? (
                            <span className="text-xs text-base-content/50 italic">Cancelled</span>
                          ) : (
                            <div className="flex items-center gap-2.5">
                              <div className="w-20 h-1.5 rounded-full bg-base-300/80 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${pct === 100 ? "bg-success" : "bg-primary"}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="font-mono text-xs text-base-content/70">
                                {verifiedCount}/{totalCount}
                              </span>
                            </div>
                          )}
                        </td>

                        <td data-label="Escrow" className="px-4 py-4 whitespace-nowrap font-mono text-xs font-semibold text-base-content">
                          {isTaskCancelled ? (
                            <span className="text-base-content/50">
                              <span className="line-through">{Number(task.budget).toFixed(2)} {currency}</span>
                              <span className="no-underline text-[10px] ml-1.5 font-sans font-normal text-success">
                                Refunded
                              </span>
                            </span>
                          ) : (
                            <span>{Number(task.budget).toFixed(2)} {currency}</span>
                          )}
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <Link
                            to={`/task/${task.taskId}`}
                            className="btn btn-ghost btn-xs text-xs font-medium gap-1 text-base-content/70 group-hover:text-base-content"
                          >
                            <span>Open</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
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
      )}
    </div>
  );
};

export default CustomerDashboard;
