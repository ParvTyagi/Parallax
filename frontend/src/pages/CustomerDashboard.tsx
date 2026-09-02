import { useState, useEffect, useMemo, useRef } from "react";
import { useWeb3 } from "../contexts/Web3Context";
import { ethers } from "ethers";
import { API_URL } from "../lib/constants";
import { taskHeadline, taskHeadlineText, MISSING_BRIEF_HINT } from "../lib/utils";
import { Link } from "react-router-dom";
import { ReviewSubtasksModal, type DraftSubtask } from "../components/task/ReviewSubtasksModal";
import {
  AttachmentUploader,
  formatBytes,
  type UploadedAttachment,
} from "../components/task/AttachmentUploader";
import {
  Layers,
  CheckCircle2,
  Coins,
  Sparkles,
  Shield,
  ArrowRight,
  AlertCircle,
  Clock,
  Search,
  Lock,
} from "lucide-react";

const BADGE_MAP: Record<string, { label: string; cls: string }> = {
  OPEN:            { label: "OPEN", cls: "badge-info" },
  CLAIMED:         { label: "CLAIMED", cls: "badge-warning" },
  SUBMITTED:       { label: "SUBMITTED", cls: "badge-secondary" },
  PENDING_RELEASE: { label: "DISPUTE WINDOW", cls: "badge-warning" },
  IN_DISPUTE:      { label: "IN DISPUTE", cls: "badge-error" },
  VERIFIED:        { label: "VERIFIED", cls: "badge-success" },
  FAILED:          { label: "FAILED", cls: "badge-error" },
  REJECTED:        { label: "REJECTED", cls: "badge-error" },
};

const PROMPT_TEMPLATES = [
  {
    label: "DeFi Research",
    text: "Research the top 5 decentralized liquidity protocols on Monad, compare their fee structures, TVL growth, and summarize key findings in structured markdown.",
    budget: "10.0",
  },
  {
    label: "Smart Contract Audit",
    text: "Review the ERC-20 staking vault contract for reentrancy vectors, unhandled return values, integer underflow risks, and produce a formal security report.",
    budget: "25.0",
  },
  {
    label: "Data Annotation",
    text: "Analyze and categorize 200 customer support tickets into billing, technical, and feature request buckets with confidence scores.",
    budget: "8.5",
  },
];

const CustomerDashboard = () => {
  const { account, balance, taskManager, connectWallet } = useWeb3();
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [errorText, setErrorText] = useState("");
  const [attachment, setAttachment] = useState<UploadedAttachment | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [aiModel, setAiModel] = useState("gemini-3.7-flash");
  const [activeTab, setActiveTab] = useState<"create" | "tasks">("create");

  const DESCRIPTION_MAX = 2000;
  /// Below this a brief rarely carries enough scope for the orchestrator to cut
  /// it into subtasks a stranger can execute without asking questions.
  const DESCRIPTION_ADVISORY_MIN = 80;

  const budgetNum = Number(budget);
  const balanceNum = balance === null ? null : Number(balance);

  /// One place that decides whether the form can be submitted, so the button and
  /// the message under it can never disagree.
  const validation = useMemo(() => {
    if (!description.trim()) return { ok: false, reason: "Add a job description first." };
    if (!budget.trim()) return { ok: false, reason: "Set a budget in MON." };
    if (!Number.isFinite(budgetNum) || budgetNum <= 0) {
      return { ok: false, reason: "Budget must be greater than 0 MON." };
    }
    return { ok: true, reason: "" };
  }, [description, budget, budgetNum]);

  /// Advisory only — never blocks. Gas is paid on top of the escrowed budget and
  /// the balance can change between now and signing.
  const overBalance = balanceNum !== null && budgetNum > 0 && budgetNum > balanceNum;
  const briefIsThin =
    description.trim().length > 0 && description.trim().length < DESCRIPTION_ADVISORY_MIN;

  /// The orchestrator is prompted for 3-5 subtasks and splits the budget across
  /// them, so this is the range a creator should expect per subtask.
  const perSubtask =
    budgetNum > 0
      ? { high: budgetNum / 3, low: budgetNum / 5 }
      : null;

  const tabRefs = useRef<Partial<Record<"create" | "tasks", HTMLButtonElement | null>>>({});

  /// Arrow/Home/End navigation, which the ARIA tab pattern requires once the
  /// buttons are exposed as role="tab".
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

  const [draftDecomposition, setDraftDecomposition] = useState<{
    masterTask: string;
    masterTaskCID: string;
    masterObjective?: string;
    successCriteria?: string[];
    subtasks: Array<{
      rangeLabel: string;
      description?: string;
      descriptionCID: string;
      objective?: string;
      contextNotes?: string;
      acceptanceCriteria?: string[];
      deliverableFormat?: string;
      skills?: string[];
      estimatedMinutes?: number;
      reward: number;
      leaseDuration: number;
    }>;
  } | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  useEffect(() => {
    if (account) fetchCustomerTasks(account);
    else setMyTasks([]);
  }, [account]);

  // Polls for as long as a wallet is connected. Must not be gated on having
  // tasks already: a first-time creator starts empty, and their first task only
  // appears once the backend has indexed it.
  useEffect(() => {
    if (!account) return;
    const interval = setInterval(() => fetchCustomerTasks(account), 5000);
    return () => clearInterval(interval);
  }, [account]);

  const fetchCustomerTasks = async (walletAddress: string) => {
    try {
      const res = await fetch(`${API_URL}/api/tasks/customer/${walletAddress}`);
      if (res.ok) setMyTasks(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  /// Indexes this transaction from its receipt rather than waiting for the block
  /// poller. Best-effort - the poller still picks it up if this fails.
  const syncTaskTx = async (txHash: string) => {
    try {
      const res = await fetch(`${API_URL}/api/tasks/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash }),
      });
      return res.ok;
    } catch (e) {
      console.warn("Task sync failed, falling back to the chain poller:", e);
      return false;
    }
  };

  /// Waits for the task to appear in the indexer, so the creator is never
  /// dropped onto an empty "My Tasks" tab.
  const waitForIndexedTask = async (walletAddress: string, previousCount: number) => {
    for (let attempt = 0; attempt < 15; attempt++) {
      try {
        const res = await fetch(`${API_URL}/api/tasks/customer/${walletAddress}`);
        if (res.ok) {
          const tasks = await res.json();
          if (Array.isArray(tasks) && tasks.length > previousCount) {
            setMyTasks(tasks);
            return true;
          }
        }
      } catch {
        // Keep retrying — a transient failure shouldn't end the wait.
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    return false;
  };

  const handleDecompose = async () => {
    if (!account) {
      await connectWallet();
      return;
    }
    if (!validation.ok) {
      // Previously this returned silently, so an invalid budget made the button
      // look broken rather than telling the creator what was wrong.
      setErrorText(validation.reason);
      return;
    }
    setIsProcessing(true);
    setErrorText("");
    try {
      let finalDescription = description.trim();

      if (isPrivate) {
        setStatusText("Encrypting payload with Lit Protocol…");
        await new Promise((r) => setTimeout(r, 1500));
        finalDescription = `[ENCRYPTED_LIT_PROTOCOL_PAYLOAD] Original length: ${description.length}\n${finalDescription}`;
      }

      if (attachment) {
        // Already pinned by the uploader; `ipfs://<cid>` is the marker the task
        // page parses back out to render the attachment panel.
        const detail = attachment.isArchive && attachment.entryCount
          ? `${attachment.filename} (${attachment.entryCount} files, ${formatBytes(attachment.size)})`
          : `${attachment.filename} (${formatBytes(attachment.size)})`;
        finalDescription += `\n\nAttached Dataset: ${detail} - ipfs://${attachment.cid}`;
      }

      setStatusText("Pinning master task spec to IPFS…");
      const ipfsRes = await fetch(`${API_URL}/api/ipfs/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: finalDescription }),
      });
      const ipfsData = await ipfsRes.json();
      if (!ipfsRes.ok) throw new Error(ipfsData.error || "IPFS upload failed");

      setStatusText(`Decomposing task via ${aiModel}…`);
      const res = await fetch(`${API_URL}/api/decompose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descriptionCID: ipfsData.cid, budget, aiModel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI Decomposition failed");

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

  const handleConfirmCreateTask = async (result: { masterTaskCID: string; finalSubtasks: DraftSubtask[] }) => {
    setIsReviewOpen(false);
    setIsProcessing(true);
    setErrorText("");
    try {
      setStatusText("Pinning edited subtask specs to IPFS…");
      const resolvedSubtasks = await Promise.all(
        result.finalSubtasks.map(async (st) => {
          // On-chain `description` is always a CID, so an edited row needs a
          // fresh pin. `/respec` re-renders the brief and re-saves the spec
          // against the new CID, keeping criteria and CID in sync.
          if (!st.isEdited && st.descriptionCID) {
            return { ...st, descriptionCID: st.descriptionCID };
          }
          const pinRes = await fetch(`${API_URL}/api/decompose/respec`, {
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
              reward: parseFloat(st.reward) || 0,
              leaseDuration: st.leaseDuration,
              masterObjective: draftDecomposition?.masterObjective || "",
            }),
          });
          const pinData = await pinRes.json();
          if (!pinRes.ok) throw new Error(pinData.error || "IPFS upload failed for an edited subtask");
          return { ...st, descriptionCID: pinData.cid };
        })
      );

      setStatusText("Confirming Monad escrow funding in MetaMask…");
      let totalValue = 0n;
      const subtasksFormatted = resolvedSubtasks.map((st) => {
        const rewardStr = parseFloat(st.reward || "0").toFixed(4);
        const r = ethers.parseEther(rewardStr);
        totalValue += r;
        return {
          rangeLabel: String(st.rangeLabel || "Subtask"),
          description: String(st.descriptionCID || ""),
          reward: r,
          leaseDuration: BigInt(st.leaseDuration || 1800),
        };
      });

      if (!taskManager) {
        throw new Error("Web3 provider not initialized. Please reconnect your wallet.");
      }

      const tx = await taskManager.createTask(
        result.masterTaskCID,
        subtasksFormatted,
        { value: totalValue }
      );

      setStatusText("Transaction submitted! Waiting for Monad confirmation…");
      await tx.wait();

      setStatusText("Confirmed. Indexing your task…");
      const previousCount = myTasks.length;
      await syncTaskTx(tx.hash);

      setDescription("");
      setBudget("");
      setAttachment(null);
      setIsPrivate(false);
      setDraftDecomposition(null);
      setActiveTab("tasks");

      const appeared = account ? await waitForIndexedTask(account, previousCount) : false;
      setStatusText("");
      setIsProcessing(false);
      if (!appeared) {
        setErrorText(
          `Task was published on-chain (tx ${tx.hash.slice(0, 10)}…) but the indexer hasn't caught up yet. It will appear here shortly.`
        );
      }
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

  const handleCancelReview = () => {
    setIsReviewOpen(false);
    setDraftDecomposition(null);
    setIsProcessing(false);
    setStatusText("");
  };

  const activeCount = myTasks.filter((t) =>
    t.subtasks.some((st: any) => st.state !== "VERIFIED")
  ).length;
  const completedCount = myTasks.filter(
    (t) =>
      t.subtasks.length > 0 &&
      t.subtasks.every((st: any) => st.state === "VERIFIED")
  ).length;
  const totalEscrowedMON = myTasks
    .reduce((acc, t) => acc + Number(t.budget || 0), 0)
    .toFixed(2);

  const filteredTasks = myTasks.filter((t) => {
    if (!searchFilter) return true;
    return taskHeadlineText(t).toLowerCase().includes(searchFilter.toLowerCase());
  });

  return (
    <div className="animate-in fade-in duration-300 pb-20">
      {/* ─── Header Section ─── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-base-content">
            Client Workspace
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            Publish complex goals, fund trustless escrows, and let Gemini AI coordinate decentralized execution.
          </p>
        </div>

        {/* Action button if on tasks tab */}
        {activeTab === "tasks" && (
          <button
            onClick={() => setActiveTab("create")}
            className="btn btn-neutral btn-sm font-semibold gap-1.5 self-start md:self-auto"
          >
            <Sparkles aria-hidden="true" className="w-3.5 h-3.5" />
            New Project
          </button>
        )}
      </div>

      {/* ─── Metric KPI Cards ─── */}
      {account && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card bg-base-100 border border-base-300/80 shadow-xs">
            <div className="card-body p-4 md:p-5">
              <div className="flex items-center justify-between text-base-content/60 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Active Projects</span>
                <Clock className="w-4 h-4 text-info" />
              </div>
              <div className="text-2xl md:text-3xl font-bold font-mono text-base-content">
                {activeCount}
              </div>
              <span className="text-[11px] text-base-content/60">Under active execution</span>
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300/80 shadow-xs">
            <div className="card-body p-4 md:p-5">
              <div className="flex items-center justify-between text-base-content/60 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Completed</span>
                <CheckCircle2 className="w-4 h-4 text-success" />
              </div>
              <div className="text-2xl md:text-3xl font-bold font-mono text-success">
                {completedCount}
              </div>
              <span className="text-[11px] text-base-content/60">Verified & settled</span>
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300/80 shadow-xs">
            <div className="card-body p-4 md:p-5">
              <div className="flex items-center justify-between text-base-content/60 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Escrowed</span>
                <Coins className="w-4 h-4 text-accent" />
              </div>
              <div className="text-2xl md:text-3xl font-bold font-mono text-base-content">
                {totalEscrowedMON} <span className="text-xs font-sans font-medium text-base-content/60">MON</span>
              </div>
              <span className="text-[11px] text-base-content/60">Locked in smart contract</span>
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300/80 shadow-xs">
            <div className="card-body p-4 md:p-5">
              <div className="flex items-center justify-between text-base-content/60 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Total Subtasks</span>
                <Layers className="w-4 h-4 text-secondary" />
              </div>
              <div className="text-2xl md:text-3xl font-bold font-mono text-base-content">
                {myTasks.reduce((acc, t) => acc + (t.subtasks?.length || 0), 0)}
              </div>
              <span className="text-[11px] text-base-content/60">Across all projects</span>
            </div>
          </div>
        </div>
      )}

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

      {/* ─── CREATE PROJECT TAB ─── */}
      {activeTab === "create" && (
        <div
          role="tabpanel"
          id="panel-create"
          aria-labelledby="tab-create"
          className="grid grid-cols-1 lg:grid-cols-3 gap-8"
        >
          {/* Main Form (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card bg-base-100 border border-base-300/80 shadow-xs">
              <div className="card-body p-6 md:p-8 gap-6">
                <div>
                  <h2 className="text-lg font-bold text-base-content">Project Specifications</h2>
                  <p className="text-xs text-base-content/60 mt-0.5">
                    Provide detailed requirements. Gemini will break it down into 3-5 verifiable subtasks.
                  </p>
                </div>

                {/* Quick Templates */}
                <div>
                  <span className="text-xs font-semibold text-base-content/60 mb-2 block">
                    Quick Templates:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {PROMPT_TEMPLATES.map((tmpl) => (
                      <button
                        key={tmpl.label}
                        type="button"
                        onClick={() => {
                          // Applying a template replaces whatever is typed, so
                          // confirm rather than silently discarding the draft.
                          if (
                            description.trim() &&
                            !window.confirm("Replace your current description with this template?")
                          ) {
                            return;
                          }
                          setDescription(tmpl.text);
                          setBudget(tmpl.budget);
                        }}
                        className="btn btn-xs btn-outline border-base-300 text-base-content/70 hover:bg-base-200 hover:text-base-content"
                      >
                        {tmpl.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Job Description Textarea */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="task-description"
                    className="text-xs font-bold text-base-content uppercase tracking-wider flex justify-between"
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
                    placeholder="e.g. Research the top 10 DeFi protocols by TVL on Monad, evaluate their smart contract architecture, and deliver an executive summary in Markdown..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isProcessing}
                    maxLength={DESCRIPTION_MAX}
                  />
                  <p id="task-description-hint" className="sr-only">
                    Describe the work you want done. The orchestrator splits this into
                    independent subtasks. Maximum {DESCRIPTION_MAX} characters.
                  </p>

                  {description.length >= DESCRIPTION_MAX && (
                    <p className="text-[11px] text-error">
                      Character limit reached — further typing is discarded. Trim the brief or
                      move the detail into an attached spec file.
                    </p>
                  )}

                  {briefIsThin && (
                    <p className="text-[11px] text-warning flex items-start gap-1.5">
                      <AlertCircle aria-hidden="true" className="w-3.5 h-3.5 shrink-0 mt-px" />
                      <span>
                        This brief is short. Workers cannot ask questions, so state the scope,
                        the quantity, and what the finished deliverable looks like — vague briefs
                        produce vague subtasks.
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
                    Budget in MON (required)
                  </label>
                  <div className="join w-full max-w-xs">
                    <span className="join-item btn btn-sm bg-base-200 border-base-300 font-mono font-bold text-xs">
                      MON
                    </span>
                    <input
                      id="task-budget"
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      aria-describedby="task-budget-hint"
                      className="input input-sm input-bordered join-item w-full font-mono text-sm"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      disabled={isProcessing}
                    />
                  </div>
                  <p id="task-budget-hint" className="text-[11px] text-base-content/60">
                    Escrowed on Monad & split across generated subtasks. Sybil resistance comes from the
                    MON bond every worker posts to claim a subtask, not from a reputation gate.
                  </p>

                  {perSubtask && (
                    <p className="text-[11px] text-base-content/60 font-mono">
                      ≈ 3–5 subtasks · roughly {perSubtask.low.toFixed(2)}–{perSubtask.high.toFixed(2)}{" "}
                      MON each
                    </p>
                  )}

                  {overBalance && (
                    <p className="text-[11px] text-warning flex items-start gap-1.5">
                      <AlertCircle aria-hidden="true" className="w-3.5 h-3.5 shrink-0 mt-px" />
                      <span>
                        This is more than your {balance} MON balance. The escrow transaction will be
                        rejected at signing, and gas is charged on top of the budget.
                      </span>
                    </p>
                  )}
                </div>

                {/* Dataset Attachment (optional) */}
                <div className="space-y-1.5 pt-2 border-t border-base-300/60">
                  <label className="text-xs font-bold text-base-content uppercase tracking-wider">
                    Attach Dataset / Spec Files (optional)
                  </label>
                  <p className="text-[11px] text-base-content/60">
                    Pick several files or a whole folder. They are zipped in your browser before
                    upload, pinned to IPFS as one archive, and workers can browse or download
                    individual files from the task page.
                  </p>
                  <AttachmentUploader
                    attachment={attachment}
                    onChange={setAttachment}
                    disabled={isProcessing}
                  />
                </div>

                {/* AI Model & Lit Privacy */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-base-300/60">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="task-ai-model"
                      className="text-xs font-bold text-base-content uppercase tracking-wider"
                    >
                      AI Orchestrator Engine
                    </label>
                    <select
                      id="task-ai-model"
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      disabled={isProcessing}
                      className="select select-sm select-bordered w-full text-xs"
                    >
                      <option value="gemini-3.7-flash">⚡ Gemini 3.7 Flash — Deep Reasoning</option>
                      <option value="gemini-3.6-flash">✦ Gemini 3.6 Flash — Balanced</option>
                      <option value="gemini-3.5-flash">✦ Gemini 3.5 Flash — Ultra-fast</option>
                      <option value="gemini-3.1-pro-preview">🧠 Gemini 3.1 Pro — Advanced</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-base-content uppercase tracking-wider">
                      Payload Privacy
                    </label>
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-base-200/60 border border-base-300">
                      <div className="flex items-center gap-2">
                        <Lock aria-hidden="true" className="w-3.5 h-3.5 text-base-content/60" />
                        <div>
                          <p className="text-xs font-semibold text-base-content">Lit Protocol Encryption</p>
                          <p className="text-[10px] text-base-content/60">Only claimant workers can decrypt</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        aria-label="Encrypt the job description with Lit Protocol so only claimant workers can read it"
                        className="toggle toggle-sm toggle-neutral"
                        checked={isPrivate}
                        onChange={(e) => setIsPrivate(e.target.checked)}
                        disabled={isProcessing}
                      />
                    </div>
                  </div>
                </div>

                {/* Error Banner */}
                {errorText && (
                  <div role="alert" className="alert alert-error text-xs py-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{errorText}</span>
                  </div>
                )}

                {/* Progress for the multi-step create flow. Announced politely so
                    a screen-reader user hears each step, not just the spinner. */}
                <p role="status" aria-live="polite" className="sr-only">
                  {isProcessing ? statusText || "Working…" : ""}
                </p>

                {draftDecomposition && (
                  <ReviewSubtasksModal
                    open={isReviewOpen}
                    masterTask={draftDecomposition.masterTask}
                    masterTaskCID={draftDecomposition.masterTaskCID}
                    masterObjective={draftDecomposition.masterObjective}
                    successCriteria={draftDecomposition.successCriteria}
                    budget={budget}
                    subtasks={draftDecomposition.subtasks}
                    onConfirm={handleConfirmCreateTask}
                    onCancel={handleCancelReview}
                  />
                )}

                {/* Submit Action */}
                <div className="pt-2 border-t border-base-300/60 space-y-2">
                  {/* Disabled only while work is in flight. An invalid form keeps
                      the button live so pressing it explains what is missing,
                      instead of presenting a control that silently does nothing. */}
                  <button
                    onClick={handleDecompose}
                    disabled={isProcessing}
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
                        Request AI Decomposition & Fund Escrow
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
                      Nothing is spent yet — you review the generated subtasks before any MON is
                      escrowed.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Info Sidebar (1 col) */}
          <div className="space-y-5">
            <div className="card bg-base-100 border border-base-300/80 shadow-xs">
              <div className="card-body p-5 gap-4">
                <div className="flex items-center gap-2 text-sm font-bold text-base-content">
                  <Sparkles aria-hidden="true" className="w-4 h-4 text-accent" />
                  <span>How AI Decomposition Works</span>
                </div>
                <ul className="space-y-3 text-xs text-base-content/70 leading-relaxed">
                  <li className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-base-200 border border-base-300 flex items-center justify-center font-mono font-bold text-[10px] shrink-0">
                      1
                    </span>
                    <span>Gemini analyzes your objective and breaks it into 3 to 5 independent subtasks.</span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-base-200 border border-base-300 flex items-center justify-center font-mono font-bold text-[10px] shrink-0">
                      2
                    </span>
                    <span>
                      You review and edit every subtask — objective, acceptance criteria and reward —
                      before anything is signed.
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-base-200 border border-base-300 flex items-center justify-center font-mono font-bold text-[10px] shrink-0">
                      3
                    </span>
                    <span>
                      Your MON is escrowed on Monad in one transaction and released per subtask as
                      each deliverable clears verification.
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="card bg-base-100 border border-base-300/80 shadow-xs">
              <div className="card-body p-5 gap-3 text-xs text-base-content/60 leading-relaxed">
                <div className="flex items-center gap-2 font-bold text-base-content">
                  <Shield aria-hidden="true" className="w-4 h-4 text-success" />
                  <span>How your budget is protected</span>
                </div>
                <p>
                  Workers stake MON before claiming a subtask. If they submit invalid work or
                  abandon the lease, their stake is slashed and the subtask reopens automatically.
                </p>
                <p>
                  Work that passes AI verification is not paid out immediately — it waits 48 hours
                  in a dispute window, so you can reject a weak deliverable before the MON is
                  released.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MY PROJECTS TAB ─── */}
      {activeTab === "tasks" && (
        <div role="tabpanel" id="panel-tasks" aria-labelledby="tab-tasks" className="space-y-6">
          {/* Search bar */}
          {myTasks.length > 0 && (
            <div className="flex justify-between items-center gap-4">
              <div className="relative max-w-sm w-full">
                <Search
                  aria-hidden="true"
                  className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/60"
                />
                <input
                  type="search"
                  placeholder="Filter your projects…"
                  aria-label="Filter your projects by description"
                  className="input input-sm input-bordered w-full pl-9 text-xs"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
              </div>
            </div>
          )}

          {!account ? (
            <div className="card bg-base-100 border border-base-300/80 p-12 text-center">
              <div className="max-w-md mx-auto space-y-4">
                <div className="w-12 h-12 rounded-full bg-base-200 flex items-center justify-center mx-auto text-base-content/60">
                  <Coins className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-base-content">Connect Wallet</h3>
                <p className="text-xs text-base-content/60 leading-relaxed">
                  Connect your Web3 wallet to view and manage your active task escrows on Monad.
                </p>
                <button onClick={connectWallet} className="btn btn-neutral btn-sm font-semibold">
                  Connect Wallet
                </button>
              </div>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="card bg-base-100 border border-base-300/80 p-12 text-center">
              <div className="max-w-md mx-auto space-y-4">
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
                    setActiveTab("create");
                  }}
                  className="btn btn-neutral btn-sm font-semibold"
                >
                  Create Your First Project
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredTasks.map((task) => {
                const verifiedCount = task.subtasks.filter(
                  (st: any) => st.state === "VERIFIED"
                ).length;
                const totalCount = task.subtasks.length;
                const pct = totalCount > 0 ? (verifiedCount / totalCount) * 100 : 0;
                const isComplete = totalCount > 0 && verifiedCount === totalCount;
                const headline = taskHeadline(task);

                return (
                  <Link
                    to={`/task/${task.taskId}`}
                    key={task.taskId}
                    className="card bg-base-100 border border-base-300/80 hover:border-base-content/30 hover:shadow-md transition-all group"
                  >
                    <div className="card-body p-5 gap-4">
                      {/* Top row */}
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-mono text-base-content/60 uppercase block mb-1">
                            ID: #{task.taskId?.slice(0, 8)}
                          </span>
                          <h3
                            className={`text-sm leading-snug line-clamp-2 transition-colors ${
                              headline.isPlaceholder
                                ? "italic font-normal text-base-content/60"
                                : "font-semibold text-base-content group-hover:text-primary"
                            }`}
                            title={headline.isPlaceholder ? MISSING_BRIEF_HINT : undefined}
                          >
                            {headline.text}
                          </h3>
                        </div>
                        <span className="badge badge-neutral font-mono font-bold text-xs shrink-0">
                          {Number(task.budget).toFixed(2)} MON
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-base-content/60">
                          <span>
                            {verifiedCount} of {totalCount} subtasks completed
                          </span>
                          <span className="font-mono font-semibold">{pct.toFixed(0)}%</span>
                        </div>
                        <progress
                          className={`progress w-full h-1.5 ${
                            isComplete ? "progress-success" : "progress-primary"
                          }`}
                          value={pct}
                          max={100}
                        />
                      </div>

                      {/* Subtask Status Chips */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-base-300/60">
                        <div className="flex flex-wrap gap-1.5">
                          {task.subtasks.slice(0, 3).map((st: any) => {
                            const badge = BADGE_MAP[st.state] || { label: st.state, cls: "badge-ghost" };
                            return (
                              <span
                                key={st.subtaskId}
                                className={`badge badge-xs ${badge.cls} font-mono`}
                              >
                                {badge.label}
                              </span>
                            );
                          })}
                          {task.subtasks.length > 3 && (
                            <span className="badge badge-xs badge-ghost font-mono">
                              +{task.subtasks.length - 3} more
                            </span>
                          )}
                        </div>

                        <span className="text-xs font-semibold text-base-content/60 group-hover:text-base-content flex items-center gap-1">
                          View Graph <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomerDashboard;




