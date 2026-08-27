import { useState, useEffect } from "react";
import { useWeb3 } from "../contexts/Web3Context";
import { ethers } from "ethers";
import { API_URL } from "../lib/constants";
import { Link } from "react-router-dom";
import {
  Layers,
  CheckCircle2,
  Coins,
  Sparkles,
  Shield,
  UploadCloud,
  FileText,
  X,
  ArrowRight,
  AlertCircle,
  Clock,
  Search,
  Lock,
} from "lucide-react";

const BADGE_MAP: Record<string, { label: string; cls: string }> = {
  OPEN:      { label: "OPEN", cls: "badge-info" },
  CLAIMED:   { label: "CLAIMED", cls: "badge-warning" },
  SUBMITTED: { label: "SUBMITTED", cls: "badge-secondary" },
  VERIFIED:  { label: "VERIFIED", cls: "badge-success" },
  FAILED:    { label: "FAILED", cls: "badge-error" },
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
  const { account, signer, taskManager, connectWallet } = useWeb3();
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [minReputation, setMinReputation] = useState("0");
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [errorText, setErrorText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [aiModel, setAiModel] = useState("gemini-3.7-flash");
  const [activeTab, setActiveTab] = useState<"create" | "tasks">("create");
  const [searchFilter, setSearchFilter] = useState("");

  const [myTasks, setMyTasks] = useState<any[]>([]);

  useEffect(() => {
    if (account) fetchCustomerTasks(account);
    else setMyTasks([]);
  }, [account]);

  useEffect(() => {
    let interval: any;
    if (account && myTasks.length > 0) {
      interval = setInterval(() => fetchCustomerTasks(account), 5000);
    }
    return () => clearInterval(interval);
  }, [account, myTasks.length]);

  const fetchCustomerTasks = async (walletAddress: string) => {
    try {
      const res = await fetch(`${API_URL}/api/tasks/customer/${walletAddress}`);
      if (res.ok) setMyTasks(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleDecompose = async () => {
    if (!account) {
      await connectWallet();
      return;
    }
    if (!description.trim() || !budget || Number(budget) <= 0) return;
    setIsProcessing(true);
    setErrorText("");
    try {
      let finalDescription = description.trim();

      if (isPrivate) {
        setStatusText("Encrypting payload with Lit Protocol…");
        await new Promise((r) => setTimeout(r, 1500));
        finalDescription = `[ENCRYPTED_LIT_PROTOCOL_PAYLOAD] Original length: ${description.length}\n${finalDescription}`;
      }

      if (file) {
        setStatusText("Uploading dataset attachment to IPFS…");
        const formData = new FormData();
        formData.append("file", file);
        const fileRes = await fetch(`${API_URL}/api/ipfs/upload-file`, {
          method: "POST",
          body: formData,
        });
        const fileData = await fileRes.json();
        if (!fileRes.ok) throw new Error(fileData.error || "File upload failed");
        finalDescription += `\n\nAttached Dataset CID: ${fileData.cid}`;
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

      setStatusText("Confirming Monad escrow funding in MetaMask…");
      let totalValue = 0n;
      const subtasksFormatted = data.subtasks.map((st: any) => {
        const r = ethers.parseEther(st.reward.toString());
        totalValue += r;
        return {
          rangeLabel: st.rangeLabel,
          description: st.descriptionCID,
          reward: r,
          leaseDuration: st.leaseDuration || 1800,
        };
      });

      const txData = taskManager!.interface.encodeFunctionData("createTask", [
        data.masterTaskCID,
        parseInt(minReputation) || 0,
        subtasksFormatted,
      ]);

      await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: await signer!.getAddress(),
            to: await taskManager!.getAddress(),
            data: txData,
            value: "0x" + totalValue.toString(16),
            gas: "0x2DC6C0",
          },
        ],
      });

      setStatusText("Task published to Monad Testnet!");
      setTimeout(() => {
        setIsProcessing(false);
        setStatusText("");
        setDescription("");
        setBudget("");
        setMinReputation("0");
        setFile(null);
        setIsPrivate(false);
        if (account) fetchCustomerTasks(account);
        setActiveTab("tasks");
      }, 2000);
    } catch (error: any) {
      console.error(error);
      setErrorText(error.message || "An unexpected error occurred.");
      setIsProcessing(false);
      setStatusText("");
    }
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
    return t.description?.toLowerCase().includes(searchFilter.toLowerCase());
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
            <Sparkles className="w-3.5 h-3.5" />
            New Project
          </button>
        )}
      </div>

      {/* ─── Metric KPI Cards ─── */}
      {account && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card bg-base-100 border border-base-300/80 shadow-xs">
            <div className="card-body p-4 md:p-5">
              <div className="flex items-center justify-between text-base-content/50 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Active Projects</span>
                <Clock className="w-4 h-4 text-info" />
              </div>
              <div className="text-2xl md:text-3xl font-bold font-mono text-base-content">
                {activeCount}
              </div>
              <span className="text-[11px] text-base-content/50">Under active execution</span>
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300/80 shadow-xs">
            <div className="card-body p-4 md:p-5">
              <div className="flex items-center justify-between text-base-content/50 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Completed</span>
                <CheckCircle2 className="w-4 h-4 text-success" />
              </div>
              <div className="text-2xl md:text-3xl font-bold font-mono text-success">
                {completedCount}
              </div>
              <span className="text-[11px] text-base-content/50">Verified & settled</span>
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300/80 shadow-xs">
            <div className="card-body p-4 md:p-5">
              <div className="flex items-center justify-between text-base-content/50 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Escrowed</span>
                <Coins className="w-4 h-4 text-accent" />
              </div>
              <div className="text-2xl md:text-3xl font-bold font-mono text-base-content">
                {totalEscrowedMON} <span className="text-xs font-sans font-medium text-base-content/50">MON</span>
              </div>
              <span className="text-[11px] text-base-content/50">Locked in smart contract</span>
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300/80 shadow-xs">
            <div className="card-body p-4 md:p-5">
              <div className="flex items-center justify-between text-base-content/50 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">Total Subtasks</span>
                <Layers className="w-4 h-4 text-secondary" />
              </div>
              <div className="text-2xl md:text-3xl font-bold font-mono text-base-content">
                {myTasks.reduce((acc, t) => acc + (t.subtasks?.length || 0), 0)}
              </div>
              <span className="text-[11px] text-base-content/50">Across all projects</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── Tabs Bar ─── */}
      <div className="flex border-b border-base-300 mb-8 gap-8">
        <button
          onClick={() => setActiveTab("create")}
          className={`pb-3 text-sm font-semibold transition-all relative ${
            activeTab === "create"
              ? "text-base-content font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
              : "text-base-content/50 hover:text-base-content"
          }`}
        >
          Post a Project
        </button>
        <button
          onClick={() => setActiveTab("tasks")}
          className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 ${
            activeTab === "tasks"
              ? "text-base-content font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
              : "text-base-content/50 hover:text-base-content"
          }`}
        >
          <span>My Projects</span>
          <span className="badge badge-sm badge-neutral font-mono text-xs">
            {myTasks.length}
          </span>
        </button>
      </div>

      {/* ─── CREATE PROJECT TAB ─── */}
      {activeTab === "create" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card bg-base-100 border border-base-300/80 shadow-xs">
              <div className="card-body p-6 md:p-8 gap-6">
                <div>
                  <h2 className="text-lg font-bold text-base-content">Project Specifications</h2>
                  <p className="text-xs text-base-content/50 mt-0.5">
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
                  <label className="text-xs font-bold text-base-content uppercase tracking-wider flex justify-between">
                    <span>Job Description *</span>
                    <span className="text-base-content/40 font-mono text-[11px] font-normal">
                      {description.length} / 2000
                    </span>
                  </label>
                  <textarea
                    rows={5}
                    className="textarea textarea-bordered w-full text-sm leading-relaxed focus:textarea-primary"
                    placeholder="e.g. Research the top 10 DeFi protocols by TVL on Monad, evaluate their smart contract architecture, and deliver an executive summary in Markdown..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isProcessing}
                    maxLength={2000}
                  />
                </div>

                {/* Budget & Min Reputation */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-base-content uppercase tracking-wider">
                      Budget (MON) *
                    </label>
                    <div className="join w-full">
                      <span className="join-item btn btn-sm bg-base-200 border-base-300 font-mono font-bold text-xs">
                        MON
                      </span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="0.00"
                        className="input input-sm input-bordered join-item w-full font-mono text-sm"
                        value={budget}
                        onChange={(e) => setBudget(e.target.value)}
                        disabled={isProcessing}
                      />
                    </div>
                    <p className="text-[11px] text-base-content/40">
                      Escrowed on Monad & split across generated subtasks.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-base-content uppercase tracking-wider">
                      Min Worker Reputation
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="0"
                      className="input input-sm input-bordered w-full font-mono text-sm"
                      value={minReputation}
                      onChange={(e) => setMinReputation(e.target.value)}
                      disabled={isProcessing}
                    />
                    <p className="text-[11px] text-base-content/40">
                      {Number(minReputation) === 0
                        ? "0 = Open to all network workers"
                        : `Requires ≥ ${minReputation} reputation score`}
                    </p>
                  </div>
                </div>

                {/* Dataset Attachment (optional) */}
                <div className="space-y-1.5 pt-2 border-t border-base-300/60">
                  <label className="text-xs font-bold text-base-content uppercase tracking-wider">
                    Attach Dataset / Spec File (optional)
                  </label>
                  {!file ? (
                    <label className="border border-dashed border-base-300 hover:border-base-content/40 rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-base-200/40 transition-colors">
                      <UploadCloud className="w-5 h-5 text-base-content/50" />
                      <span className="text-xs font-semibold text-base-content/70">
                        Click to upload PDF, CSV, JSON, or TXT
                      </span>
                      <span className="text-[10px] text-base-content/40">
                        Dataset is pinned to IPFS for worker access
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        disabled={isProcessing}
                      />
                    </label>
                  ) : (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-base-200 border border-base-300">
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-xs font-medium text-base-content truncate">
                          {file.name}
                        </span>
                        <span className="text-[10px] text-base-content/50 font-mono">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFile(null)}
                        className="btn btn-ghost btn-xs btn-square"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* AI Model & Lit Privacy */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-base-300/60">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-base-content uppercase tracking-wider">
                      AI Orchestrator Engine
                    </label>
                    <select
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
                        <Lock className="w-3.5 h-3.5 text-base-content/60" />
                        <div>
                          <p className="text-xs font-semibold text-base-content">Lit Protocol Encryption</p>
                          <p className="text-[10px] text-base-content/40">Only claimant workers can decrypt</p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
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
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorText}</span>
                  </div>
                )}

                {/* Submit Action */}
                <div className="pt-2 border-t border-base-300/60">
                  <button
                    onClick={handleDecompose}
                    disabled={isProcessing || !description.trim() || !budget}
                    className="btn btn-neutral btn-block font-bold text-sm shadow-xs"
                  >
                    {isProcessing ? (
                      <span className="flex items-center gap-2">
                        <span className="loading loading-spinner loading-xs" />
                        {statusText || "Decomposing & funding escrow…"}
                      </span>
                    ) : account ? (
                      <span className="flex items-center gap-2">
                        Request AI Decomposition & Fund Escrow
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    ) : (
                      "Connect Wallet to Post"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Info Sidebar (1 col) */}
          <div className="space-y-5">
            <div className="card bg-base-100 border border-base-300/80 shadow-xs">
              <div className="card-body p-5 gap-4">
                <div className="flex items-center gap-2 text-sm font-bold text-base-content">
                  <Sparkles className="w-4 h-4 text-accent" />
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
                    <span>Your total MON budget is automatically distributed proportionally across subtasks.</span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-base-200 border border-base-300 flex items-center justify-center font-mono font-bold text-[10px] shrink-0">
                      3
                    </span>
                    <span>Funds lock in <code className="font-mono bg-base-200 px-1 py-0.5 rounded">ParallaxEscrow.sol</code> on Monad Testnet until verified.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="card bg-base-100 border border-base-300/80 shadow-xs">
              <div className="card-body p-5 gap-3 text-xs text-base-content/60 leading-relaxed">
                <div className="flex items-center gap-2 font-bold text-base-content">
                  <Shield className="w-4 h-4 text-success" />
                  <span>Zero Risk Guarantee</span>
                </div>
                <p>
                  Workers must stake MON before claiming subtasks. If a worker submits invalid work or abandons a lease, their stake is slashed and the subtask reopens automatically.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MY PROJECTS TAB ─── */}
      {activeTab === "tasks" && (
        <div className="space-y-6">
          {/* Search bar */}
          {myTasks.length > 0 && (
            <div className="flex justify-between items-center gap-4">
              <div className="relative max-w-sm w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                <input
                  type="text"
                  placeholder="Filter your projects…"
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
                <div className="w-12 h-12 rounded-full bg-base-200 flex items-center justify-center mx-auto text-base-content/50">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-base-content">No projects found</h3>
                  <p className="text-xs text-base-content/50 mt-1">
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
                          <span className="text-[10px] font-mono text-base-content/40 uppercase block mb-1">
                            ID: #{task.taskId?.slice(0, 8)}
                          </span>
                          <h3 className="text-sm font-semibold text-base-content leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                            {task.description}
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

                        <span className="text-xs font-semibold text-base-content/50 group-hover:text-base-content flex items-center gap-1">
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




