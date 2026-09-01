import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWeb3 } from "../contexts/Web3Context";
import { API_URL } from "../lib/constants";
import {
  Search,
  CheckCircle2,
  Coins,
  ArrowRight,
  Clock,
  Check,
  Target,
} from "lucide-react";
import { subtaskHeadline } from "../components/task/SubtaskSpec";

const TAG_MAP: Record<string, { label: string; cls: string }> = {
  json:            { label: "JSON",       cls: "badge-info badge-outline" },
  format:          { label: "FORMAT",     cls: "badge-secondary badge-outline" },
  data:            { label: "DATA",       cls: "badge-success badge-outline" },
  research:        { label: "RESEARCH",   cls: "badge-accent badge-outline" },
  write:           { label: "WRITING",    cls: "badge-primary badge-outline" },
  writing:         { label: "WRITING",    cls: "badge-primary badge-outline" },
  article:         { label: "WRITING",    cls: "badge-primary badge-outline" },
  analys:          { label: "ANALYSIS",   cls: "badge-warning badge-outline" },
  report:          { label: "ANALYSIS",   cls: "badge-warning badge-outline" },
  api:             { label: "DEV",        cls: "badge-info badge-outline" },
  code:            { label: "DEV",        cls: "badge-info badge-outline" },
  develop:         { label: "DEV",        cls: "badge-info badge-outline" },
  blockchain:      { label: "WEB3",       cls: "badge-accent badge-outline" },
  "smart contract":{ label: "WEB3",       cls: "badge-accent badge-outline" },
  web3:            { label: "WEB3",       cls: "badge-accent badge-outline" },
};

const CATEGORIES = ["ALL", "RESEARCH", "DEV", "WRITING", "ANALYSIS", "WEB3", "DATA"];

function getAutoTags(desc: string) {
  const low = (desc || "").toLowerCase();
  const seen = new Set<string>();
  const tags: { label: string; cls: string }[] = [];
  for (const [kw, tag] of Object.entries(TAG_MAP)) {
    if (low.includes(kw) && !seen.has(tag.label)) {
      seen.add(tag.label);
      tags.push(tag);
    }
  }
  return tags;
}

const WorkerTasks = () => {
  const { account, connectWallet } = useWeb3();
  const navigate = useNavigate();
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [sortBy, setSortBy] = useState<"newest" | "reward">("newest");
  const [activeTab, setActiveTab] = useState<"available" | "active" | "completed">("available");

  useEffect(() => {
    fetchAll();
  }, [account]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [stRes, profileRes] = await Promise.all([
        fetch(`${API_URL}/api/tasks/subtasks/open`),
        account ? fetch(`${API_URL}/api/workers/${account}`) : Promise.resolve(null),
      ]);
      if (stRes.ok) setSubtasks(await stRes.json());
      if (profileRes?.ok) {
        const d = await profileRes.json();
        setProfile(d.profile);
        setMyTasks(d.claimedSubtasks || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = subtasks
    .filter((st) => {
      const desc = `${st.rangeLabel || ""} ${st.objective || ""} ${st.skills?.join(" ") || ""} ${st.description || ""}`.toLowerCase();
      const matchesSearch = !searchQuery || desc.includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (selectedCategory === "ALL") return true;
      const tags = getAutoTags(`${st.objective || st.description || ""} ${st.skills?.join(" ") || ""}`).map((t) => t.label);
      return tags.includes(selectedCategory);
    })
    .sort((a, b) => {
      if (sortBy === "reward") return Number(b.reward) - Number(a.reward);
      return Number(b.taskId) - Number(a.taskId);
    });

  const activeTasks = myTasks.filter((st) =>
    ["CLAIMED", "SUBMITTED", "PENDING_RELEASE", "IN_DISPUTE"].includes(st.state)
  );
  const completedTasks = myTasks.filter((st) => st.state === "VERIFIED");

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-80 gap-3">
        <span className="loading loading-spinner loading-md text-primary" />
        <span className="text-xs text-base-content/60 font-medium">Loading marketplace…</span>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300 pb-20">
      {/* ─── Header & Worker Stats ─── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-base-content">
            Freelancer Marketplace
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            Claim AI-decomposed microtasks with a MON bond, then get paid once your work clears the 48-hour creator dispute window.
          </p>
        </div>

        {/* Worker quick stats */}
        {account && profile && (
          <div className="flex items-center gap-3 bg-base-100 border border-base-300/80 rounded-xl p-3 shadow-xs shrink-0">
            <div className="px-3 border-r border-base-300">
              <span className="text-[10px] font-bold text-base-content/60 uppercase block">Reputation</span>
              <div className="flex items-center gap-1.5 font-mono font-bold text-base text-base-content">
                <span>{profile.reputationScore}</span>
                {profile.reputationScore >= 80 && (
                  <span className="badge badge-warning badge-xs text-[9px] font-bold">TOP 10%</span>
                )}
              </div>
            </div>

            <div className="px-3">
              <span className="text-[10px] font-bold text-base-content/60 uppercase block">Completed</span>
              <span className="font-mono font-bold text-base text-success">
                {profile.successfulTasks ?? 0}
              </span>
            </div>

          </div>
        )}
      </div>

      {/* ─── Tabs ─── */}
      <div className="flex border-b border-base-300 mb-6 gap-8">
        <button
          onClick={() => setActiveTab("available")}
          className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 ${
            activeTab === "available"
              ? "text-base-content font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
              : "text-base-content/60 hover:text-base-content"
          }`}
        >
          <span>Available Tasks</span>
          <span className="badge badge-sm badge-neutral font-mono text-xs">{filtered.length}</span>
        </button>

        <button
          onClick={() => setActiveTab("active")}
          className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 ${
            activeTab === "active"
              ? "text-base-content font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
              : "text-base-content/60 hover:text-base-content"
          }`}
        >
          <span>Active Work</span>
          {activeTasks.length > 0 && (
            <span className="badge badge-sm badge-warning font-mono text-xs">
              {activeTasks.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("completed")}
          className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 ${
            activeTab === "completed"
              ? "text-base-content font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
              : "text-base-content/60 hover:text-base-content"
          }`}
        >
          <span>Completed</span>
          <span className="badge badge-sm badge-success badge-outline font-mono text-xs">
            {completedTasks.length}
          </span>
        </button>
      </div>

      {/* ─── AVAILABLE TAB ─── */}
      {activeTab === "available" && (
        <div className="space-y-6">
          {/* Filter Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search
                aria-hidden="true"
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/60"
              />
              <input
                id="worker-task-search"
                type="search"
                placeholder="Search by keywords (e.g. DeFi, smart contract, JSON)…"
                aria-label="Search open subtasks by keyword"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input input-sm input-bordered w-full pl-9 text-xs"
              />
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2 shrink-0">
              <span id="worker-sort-label" className="text-xs text-base-content/60 font-medium">
                Sort by:
              </span>
              <select
                aria-labelledby="worker-sort-label"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="select select-sm select-bordered text-xs"
              >
                <option value="newest">Newest First</option>
                <option value="reward">Highest Reward</option>
              </select>
            </div>
          </div>

          {/* Category Chips */}
          <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-1.5 pb-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                aria-pressed={selectedCategory === cat}
                onClick={() => setSelectedCategory(cat)}
                className={`btn btn-xs rounded-lg text-[11px] font-medium transition-all ${
                  selectedCategory === cat
                    ? "btn-neutral shadow-2xs"
                    : "btn-ghost bg-base-100 border border-base-300/80 text-base-content/60 hover:text-base-content"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grid of Open Subtasks */}
          {filtered.length === 0 ? (
            <div className="card bg-base-100 border border-base-300/80 p-12 text-center">
              <div className="max-w-md mx-auto space-y-3">
                <div className="w-12 h-12 rounded-full bg-base-200 flex items-center justify-center mx-auto text-base-content/60">
                  <Search className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-base-content">No available tasks found</h3>
                <p className="text-xs text-base-content/60">
                  {searchQuery || selectedCategory !== "ALL"
                    ? "Try adjusting your search terms or category filters."
                    : "There are currently no open subtasks in the marketplace. Check back soon!"}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((st) => {
                const tags = getAutoTags(`${st.objective || st.description || ""} ${st.skills?.join(" ") || ""}`);
                return (
                  <div
                    key={st.subtaskId}
                    className="card bg-base-100 border border-base-300/80 hover:border-base-content/30 hover:shadow-md transition-all flex flex-col justify-between group cursor-pointer"
                    onClick={() => navigate(`/task/${st.taskId}`)}
                  >
                    <div className="card-body p-5 gap-3.5">
                      {/* Card Header */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="badge badge-success badge-xs font-mono font-bold">
                            OPEN
                          </span>
                          <span className="text-[10px] font-mono text-base-content/60 uppercase">
                            #{st.subtaskId?.slice(0, 6)}
                          </span>
                        </div>
                        <span className="badge badge-neutral font-mono font-bold text-xs">
                          {st.reward} MON
                        </span>
                      </div>

                      {/* Title / Objective */}
                      <div>
                        <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-base-content/60 mb-1">
                          {st.rangeLabel || "Subtask"}
                        </p>
                        <p className="text-sm font-semibold text-base-content leading-snug line-clamp-3 group-hover:text-primary transition-colors">
                          {subtaskHeadline(st)}
                        </p>
                      </div>

                      {/* What "done" means — the bar this submission is graded against. */}
                      {st.acceptanceCriteria?.length > 0 && (
                        <div className="text-[11px] text-base-content/60 space-y-1">
                          <span className="flex items-center gap-1 font-bold uppercase tracking-wider text-base-content/60">
                            <Target className="w-3 h-3" />
                            {st.acceptanceCriteria.length} acceptance criteria
                          </span>
                          <ul className="space-y-0.5">
                            {st.acceptanceCriteria.slice(0, 2).map((c: string, i: number) => (
                              <li key={i} className="line-clamp-1">• {c}</li>
                            ))}
                            {st.acceptanceCriteria.length > 2 && (
                              <li className="italic opacity-70">
                                +{st.acceptanceCriteria.length - 2} more
                              </li>
                            )}
                          </ul>
                        </div>
                      )}

                      {st.deliverableFormat && (
                        <p className="text-[11px] text-base-content/60 line-clamp-1">
                          <span className="font-semibold">Deliver as:</span> {st.deliverableFormat}
                        </p>
                      )}

                      {/* Category Tags */}
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {tags.map((t) => (
                            <span key={t.label} className={`badge badge-xs ${t.cls} font-mono`}>
                              #{t.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Card Footer Action */}
                    <div className="px-5 pb-5 pt-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/task/${st.taskId}`);
                        }}
                        className="btn btn-sm btn-outline border-base-300 w-full group-hover:btn-neutral transition-all flex items-center justify-between text-xs font-semibold"
                      >
                        <span>View & Claim</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── ACTIVE WORK TAB ─── */}
      {activeTab === "active" && (
        <div className="space-y-6">
          {!account ? (
            <div className="card bg-base-100 border border-base-300/80 p-12 text-center">
              <div className="max-w-md mx-auto space-y-4">
                <Coins className="w-10 h-10 mx-auto text-base-content/60" />
                <h3 className="text-base font-bold text-base-content">Connect Wallet</h3>
                <p className="text-xs text-base-content/60">
                  Connect your wallet to see the tasks you have claimed and are actively working on.
                </p>
                <button onClick={connectWallet} className="btn btn-neutral btn-sm font-semibold">
                  Connect Wallet
                </button>
              </div>
            </div>
          ) : activeTasks.length === 0 ? (
            <div className="card bg-base-100 border border-base-300/80 p-12 text-center">
              <div className="max-w-md mx-auto space-y-3">
                <div className="w-12 h-12 rounded-full bg-base-200 flex items-center justify-center mx-auto text-base-content/60">
                  <Clock className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-base-content">No active work</h3>
                <p className="text-xs text-base-content/60">
                  You haven't claimed any tasks yet. Browse available tasks and claim one to start earning!
                </p>
                <button
                  onClick={() => setActiveTab("available")}
                  className="btn btn-neutral btn-sm font-semibold"
                >
                  Browse Available Tasks
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {activeTasks.map((st) => (
                <Link
                  to={`/task/${st.taskId}`}
                  key={st.subtaskId}
                  className="card bg-base-100 border border-base-300/80 hover:shadow-md transition-all group"
                >
                  <div className="card-body p-5 gap-3.5">
                    <div className="flex justify-between items-center">
                      <span
                        className={`badge badge-sm font-mono font-bold ${
                          st.state === "SUBMITTED"
                            ? "badge-secondary"
                            : st.state === "PENDING_RELEASE"
                            ? "badge-warning"
                            : st.state === "IN_DISPUTE"
                            ? "badge-error"
                            : "badge-warning"
                        }`}
                      >
                        {st.state === "PENDING_RELEASE" ? "DISPUTE WINDOW" : st.state === "IN_DISPUTE" ? "IN DISPUTE" : st.state}
                      </span>
                      <span className="font-mono font-bold text-xs text-base-content">
                        {st.reward} MON
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-base-content leading-snug line-clamp-3">
                      {subtaskHeadline(st)}
                    </p>

                    <div className="flex justify-between items-center pt-2 border-t border-base-300/60 text-xs text-primary font-semibold">
                      <span>
                        {st.state === "SUBMITTED"
                          ? "Awaiting AI Verification"
                          : st.state === "PENDING_RELEASE"
                          ? "In dispute window — payout pending"
                          : st.state === "IN_DISPUTE"
                          ? "Disputed — awaiting admin resolution"
                          : "Submit Deliverable"}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── COMPLETED TAB ─── */}
      {activeTab === "completed" && (
        <div className="space-y-6">
          {!account ? (
            <div className="card bg-base-100 border border-base-300/80 p-12 text-center">
              <div className="max-w-md mx-auto space-y-4">
                <Coins className="w-10 h-10 mx-auto text-base-content/60" />
                <h3 className="text-base font-bold text-base-content">Connect Wallet</h3>
                <p className="text-xs text-base-content/60">
                  Connect your wallet to review your verified completions and earned rewards.
                </p>
                <button onClick={connectWallet} className="btn btn-neutral btn-sm font-semibold">
                  Connect Wallet
                </button>
              </div>
            </div>
          ) : completedTasks.length === 0 ? (
            <div className="card bg-base-100 border border-base-300/80 p-12 text-center">
              <div className="max-w-md mx-auto space-y-3">
                <div className="w-12 h-12 rounded-full bg-base-200 flex items-center justify-center mx-auto text-base-content/60">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-base-content">No verified completions yet</h3>
                <p className="text-xs text-base-content/60">
                  Complete your first subtask and get verified by AI to build your reputation score.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {completedTasks.map((st) => (
                <Link
                  to={`/task/${st.taskId}`}
                  key={st.subtaskId}
                  className="card bg-base-100 border border-base-300/80 hover:shadow-md transition-all group"
                >
                  <div className="card-body p-5 gap-3.5">
                    <div className="flex justify-between items-center">
                      <span className="badge badge-success badge-sm font-bold gap-1">
                        <Check className="w-3 h-3" /> VERIFIED
                      </span>
                      <span className="font-mono font-bold text-xs text-success">
                        +{st.reward} MON
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-base-content leading-snug line-clamp-3">
                      {st.task?.objective || subtaskHeadline(st)}
                    </p>

                    <div className="flex justify-between items-center pt-2 border-t border-base-300/60 text-xs text-base-content/60 group-hover:text-base-content font-medium">
                      <span>View Proof & Payout</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WorkerTasks;
