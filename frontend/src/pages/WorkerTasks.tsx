import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/Tabs";
import { PageLoading, PageError } from "../components/ui/PageState";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useWeb3 } from "../contexts/Web3Context";
import { API_URL } from "../lib/constants";
import {
  Search,
  CheckCircle2,
  Coins,
  ArrowRight,
  Clock,
  Target,
  ArrowUpRight,
} from "lucide-react";
import { subtaskHeadline } from "../components/task/SubtaskSpec";

const WorkerTasks = () => {
  const { account, connectWallet, currencySymbol } = useWeb3();
  const currency = currencySymbol || "MON";
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "reward">("newest");
  const [activeTab, setActiveTab] = useState<"available" | "active" | "completed">("available");

  useEffect(() => {
    fetchAll();
  }, [account]);

  const fetchAll = async () => {
    setLoading(true);
    setLoadError("");
    if (!account) { setMyTasks([]); setProfile(null); }
    try {
      const [stRes, profileRes] = await Promise.all([
        fetch(`${API_URL}/api/tasks/subtasks/open`),
        account ? fetch(`${API_URL}/api/workers/${account}`) : Promise.resolve(null),
      ]);
      if (!stRes.ok) throw new Error("Could not load available work.");
      setSubtasks(await stRes.json());
      if (profileRes?.ok) {
        const d = await profileRes.json();
        setProfile(d.profile);
        setMyTasks(d.claimedSubtasks || []);
      }
    } catch (e) {
      console.error(e);
      setLoadError("We could not load the marketplace. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const filtered = subtasks
    .filter((st) => {
      const desc = `${st.rangeLabel || ""} ${st.objective || ""} ${st.skills?.join(" ") || ""} ${st.description || ""}`.toLowerCase();
      return !searchQuery || desc.includes(searchQuery.toLowerCase());
    })
    .sort((a, b) => {
      if (sortBy === "reward") return Number(b.reward) - Number(a.reward);
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

  const activeTasks = myTasks.filter((st) =>
    ["CLAIMED", "SUBMITTED", "VERIFICATION_FAILED", "IN_DISPUTE"].includes(st.state)
  );
  const completedTasks = myTasks.filter((st) => st.state === "VERIFIED");

  if (loading) return <PageLoading label="Loading available work…" />;
  if (loadError && subtasks.length === 0) return <PageError title="Marketplace unavailable" message={loadError} onRetry={fetchAll} />;

  return (
    <div className="marketplace-page animate-in fade-in duration-300 pb-20">
      {/* ─── Header & Worker Stats ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <p className="eyebrow mb-2">The opportunity board</p>
          <h1 className="text-2xl font-bold tracking-tight text-base-content">
            Find your next contribution.
          </h1>
          <p className="text-sm text-base-content/60 mt-0.5">
            Focused tasks. Clear deliverables. Review the scope, reward, and claim bond before you begin.
          </p>
        </div>

        {/* Worker quick stats */}
        {account && profile && (
          <div className="flex items-center gap-3 bg-base-100 border border-base-300/80 rounded-xl px-4 py-2 shadow-xs shrink-0 text-xs">
            <div className="pr-3 border-r border-base-300/80">
              <span className="text-[10px] font-bold text-base-content/60 uppercase block">Reputation</span>
              <span className="font-mono font-bold text-sm text-base-content">{profile.reputationScore}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-base-content/60 uppercase block">Completed</span>
              <span className="font-mono font-bold text-sm text-success">{profile.successfulTasks ?? 0}</span>
            </div>
          </div>
        )}
      </div>

      {/* ─── Tabs ─── */}
      <div className="marketplace-ribbon"><div><span>Available opportunities</span><strong>{subtasks.length}</strong></div><div><span>Your active claims</span><strong>{account ? activeTasks.length : "—"}</strong></div><div><span>Your completed work</span><strong>{account ? completedTasks.length : "—"}</strong></div><p>Choose a task.<br /><strong>Make a measurable impact.</strong></p></div>
      {loadError && <div role="alert" className="alert alert-error mb-5"><span>{loadError}</span><button className="btn btn-sm" onClick={fetchAll}>Retry</button></div>}
      <Tabs value={activeTab} onValueChange={value => setActiveTab(value as typeof activeTab)}><TabsList aria-label="Work opportunities" className="marketplace-tabs">
        <TabsTrigger value="available"
          className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 ${
            activeTab === "available"
              ? "text-base-content font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
              : "text-base-content/60 hover:text-base-content"
          }`}
        >
          <span>Available Tasks</span>
          <span className="badge badge-sm badge-neutral font-mono text-xs">{filtered.length}</span>
        </TabsTrigger>

        <TabsTrigger value="active"
          className={`pb-3 text-sm font-semibold transition-all relative flex items-center gap-2 ${
            activeTab === "active"
              ? "text-base-content font-bold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
              : "text-base-content/60 hover:text-base-content"
          }`}
        >
          <span>Active Claims</span>
          {activeTasks.length > 0 && (
            <span className="badge badge-sm badge-warning font-mono text-xs">
              {activeTasks.length}
            </span>
          )}
        </TabsTrigger>

        <TabsTrigger value="completed"
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
        </TabsTrigger>
      </TabsList>

      {/* ─── AVAILABLE TAB ─── */}
      <TabsContent value="available" className="space-y-6">
          {/* Search & Sort Bar */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search
                aria-hidden="true"
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/60"
              />
              <input
                id="worker-task-search"
                type="search"
                placeholder="Search open tasks…"
                aria-label="Search open subtasks by keyword"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input input-sm input-bordered w-full pl-9 text-xs"
              />
            </div>

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

          {/* Grid of Open Subtasks */}
          {filtered.length === 0 ? (
            <div className="card bg-base-100 border border-base-300/80 p-12 text-center max-w-md mx-auto">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-full bg-base-200 flex items-center justify-center mx-auto text-base-content/60">
                  <Search className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-base-content">{searchQuery ? "No matching tasks" : "No open tasks yet"}</h3>
                <p className="text-xs text-base-content/60">
                  {searchQuery
                    ? "Try a different skill or keyword to broaden your search."
                    : "There are currently no open tasks in the marketplace. Check back soon!"}
                </p>
                {searchQuery && <button className="btn btn-outline" onClick={() => setSearchQuery("")}>Clear search</button>}
              </div>
            </div>
          ) : (
            <div className="opportunity-grid">
              {filtered.map((st) => (
                <div
                  key={st.subtaskId}
                  className="opportunity-card card bg-base-100 border border-base-300/80 transition-all flex flex-col justify-between group"
                >
                  <div className="card-body p-5 gap-3.5">
                    {/* Header: Range label & Reward */}
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
                        {st.reward} {currency}
                      </span>
                    </div>

                    {/* Title */}
                    <div>
                      <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-base-content/60 mb-1">
                        {st.rangeLabel || "Microtask"}
                      </p>
                      <h3 className="text-sm font-semibold text-base-content leading-snug line-clamp-3 group-hover:text-primary transition-colors">
                        {subtaskHeadline(st)}
                      </h3>
                    </div>

                    {/* Acceptance criteria preview */}
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

                    {!!st.skills?.length && <div className="opportunity-skills">{st.skills.slice(0,3).map((skill: string) => <span key={skill}>{skill}</span>)}</div>}
                    {st.leaseDuration > 0 && <p className="opportunity-duration"><Clock size={13} aria-hidden="true" />{Math.ceil(st.leaseDuration / 60)} min submission window</p>}
                    {st.deliverableFormat && (
                      <p className="text-[11px] text-base-content/60 line-clamp-1">
                        <span className="font-semibold">Format:</span> {st.deliverableFormat}
                      </p>
                    )}
                  </div>

                  {/* Card Footer Action */}
                  <div className="px-5 pb-5 pt-0">
                    <Link to={`/task/${st.taskId}`} className="opportunity-link">
                      <span>Explore task</span><ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

      {/* ─── ACTIVE CLAIMS TAB ─── */}
      <TabsContent value="active" className="space-y-6">
          {!account ? (
            <div className="card bg-base-100 border border-base-300/80 p-12 text-center max-w-md mx-auto">
              <div className="space-y-4">
                <Coins className="w-10 h-10 mx-auto text-base-content/60" />
                <h3 className="text-base font-bold text-base-content">Connect Wallet</h3>
                <p className="text-xs text-base-content/60">
                  Connect your wallet to see the tasks you have claimed.
                </p>
                <button onClick={connectWallet} className="btn btn-neutral btn-sm font-semibold">
                  Connect Wallet
                </button>
              </div>
            </div>
          ) : activeTasks.length === 0 ? (
            <div className="card bg-base-100 border border-base-300/80 p-12 text-center max-w-md mx-auto">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-full bg-base-200 flex items-center justify-center mx-auto text-base-content/60">
                  <Clock className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-base-content">No active claims</h3>
                <p className="text-xs text-base-content/60">
                  You haven't claimed any tasks yet. Browse available tasks to start earning.
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
            <div className="opportunity-grid">
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
                            : st.state === "IN_DISPUTE"
                            ? "badge-error"
                            : "badge-warning"
                        }`}
                      >
                        {st.state === "IN_DISPUTE" ? "IN DISPUTE" : st.state}
                      </span>
                      <span className="font-mono font-bold text-xs text-base-content">
                        {st.reward} {currency}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-base-content leading-snug line-clamp-3">
                      {subtaskHeadline(st)}
                    </p>

                    <div className="flex justify-between items-center pt-2 border-t border-base-300/60 text-xs text-primary font-semibold">
                      <span>
                        {st.state === "SUBMITTED"
                          ? "Awaiting AI Verification"
                          : st.state === "VERIFICATION_FAILED"
                          ? "Verification failed - request admin review"
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
        </TabsContent>

      {/* ─── COMPLETED TAB ─── */}
      <TabsContent value="completed" className="space-y-6">
          {completedTasks.length === 0 ? (
            <div className="card bg-base-100 border border-base-300/80 p-12 text-center max-w-md mx-auto">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-full bg-base-200 flex items-center justify-center mx-auto text-base-content/60">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-base-content">No completed tasks yet</h3>
                <p className="text-xs text-base-content/60">
                  Your verified deliverables will appear here after approval.
                </p>
              </div>
            </div>
          ) : (
            <div className="opportunity-grid">
              {completedTasks.map((st) => (
                <Link
                  to={`/task/${st.taskId}`}
                  key={st.subtaskId}
                  className="card bg-base-100 border border-base-300/80 hover:shadow-md transition-all group"
                >
                  <div className="card-body p-5 gap-3">
                    <div className="flex justify-between items-center">
                      <span className="badge badge-success badge-sm font-mono font-bold">
                        VERIFIED
                      </span>
                      <span className="font-mono font-bold text-xs text-base-content">
                        +{st.reward} {currency}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-base-content leading-snug line-clamp-2">
                      {subtaskHeadline(st)}
                    </p>

                    <div className="flex justify-between items-center pt-2 border-t border-base-300/60 text-xs text-success font-medium">
                      <span>Paid & settled on-chain</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
    </Tabs>
    </div>
  );
};

export default WorkerTasks;
