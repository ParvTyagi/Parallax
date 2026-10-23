import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Plus, Search, FolderOpen, Wallet, Layers, CheckCircle2, AlertCircle } from "lucide-react";
import { useWeb3 } from "../../contexts/Web3Context";
import { API_URL } from "../../lib/constants";
import { taskHeadlineText } from "../../lib/utils";

interface TaskRow {
  taskId: string; status?: string; description: string; objective?: string | null;
  budget: string; createdAt: string; subtasks: { subtaskId: string; state: string }[];
}
function statusOf(task: TaskRow) {
  if (task.status === "CANCELLED") return "Cancelled";
  if (task.status === "COMPLETED" || (task.subtasks.length > 0 && task.subtasks.every(s => s.state === "VERIFIED"))) return "Completed";
  if (task.subtasks.some(s => s.state === "VERIFICATION_FAILED")) return "Verification failed";
  if (task.subtasks.some(s => s.state === "IN_DISPUTE")) return "In dispute";
  if (task.subtasks.some(s => ["SUBMITTED", "AWAITING_VERIFICATION"].includes(s.state))) return "In review";
  return "Active";
}
export default function CreatorDashboard() {
  const { account, connectWallet, isConnecting, currencySymbol } = useWeb3();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All projects");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    setTasks([]); setError("");
    if (!account) { setLoading(false); return; }
    let cancelled = false;
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(`${API_URL}/api/tasks/customer/${account}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Could not load your projects. Please try again.");
        const data = await response.json();
        if (!cancelled) { setTasks(data); setError(""); }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load your projects.");
      } finally { if (!cancelled) setLoading(false); }
    };
    setLoading(true); void load();
    const interval = setInterval(load, 8000);
    return () => { cancelled = true; controller.abort(); clearInterval(interval); };
  }, [account, refresh]);
  const active = tasks.filter(t => !["Completed", "Cancelled"].includes(statusOf(t))).length;
  const completed = tasks.filter(t => statusOf(t) === "Completed").length;
  const budget = tasks.reduce((sum, t) => sum + Number(t.budget || 0), 0);
  const filtered = useMemo(() => tasks.filter(t =>
    taskHeadlineText(t).toLowerCase().includes(query.toLowerCase()) &&
    (filter === "All projects" || statusOf(t) === filter)), [tasks, query, filter]);
  const currency = currencySymbol || "ETH";
  return (
    <div className="overview-page">
      <div className="overview-heading">
        <div><p className="eyebrow">Your workspace</p><h1>Project overview</h1><p>Keep your projects, budgets, and delivery progress in view.</p></div>
        <Link to="/creator/new" className="btn btn-primary gap-2"><Plus size={17} aria-hidden="true" />New project</Link>
      </div>
      <div className="overview-metrics">
        {[
          { label: "Total project budget", value: account ? budget.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—", unit: currency, icon: Wallet, note: "Across all projects" },
          { label: "Active projects", value: account ? active : "—", unit: "", icon: Layers, note: "Work currently in progress" },
          { label: "Completed projects", value: account ? completed : "—", unit: "", icon: CheckCircle2, note: "Verified and delivered" }
        ].map(({label,value,unit,icon:Icon,note}) => <div key={label} className="overview-metric"><div className="metric-label">{label}<Icon size={18} aria-hidden="true" /></div><div className="metric-value">{value}<span>{unit}</span></div><p>{note}</p></div>)}
      </div>
      <section className="project-register" aria-labelledby="projects-heading">
        <div className="register-heading"><div><h2 id="projects-heading">Projects <span>{tasks.length}</span></h2><p>Manage the work you have commissioned.</p></div><label className="project-search"><Search size={17} aria-hidden="true" /><input type="search" aria-label="Search projects" placeholder="Search projects…" value={query} onChange={e => setQuery(e.target.value)} /></label></div>
        <div className="project-filters" role="group" aria-label="Filter projects by status">{["All projects", "Active", "In review", "Verification failed", "In dispute", "Completed", "Cancelled"].map(label => <button key={label} aria-pressed={filter === label} onClick={() => setFilter(label)}>{label}</button>)}</div>
        {error && <div role="alert" className="register-error"><AlertCircle size={18} aria-hidden="true" /><span>{error}</span><button className="btn btn-sm btn-ghost" onClick={() => setRefresh(v => v + 1)}>Retry</button></div>}
        {!account ? <div className="workspace-empty"><Wallet size={28} aria-hidden="true" /><h3>Your workspace starts here</h3><p>Connect your wallet to see your projects and track their progress.</p><button className="btn btn-primary" onClick={connectWallet} disabled={isConnecting}>{isConnecting ? "Connecting…" : "Connect wallet"}</button></div>
          : loading ? <div role="status" className="workspace-empty"><span className="loading loading-spinner" /><p>Loading your projects…</p></div>
          : !filtered.length ? <div className="workspace-empty"><FolderOpen size={30} aria-hidden="true" /><h3>{tasks.length ? "No matching projects" : error ? "Projects are unavailable" : "Bring your first project to life"}</h3><p>{tasks.length ? "Try another search or status filter." : error ? "Retry to load your latest project information." : "Start with a brief. Review the plan before funding any work."}</p>{tasks.length > 0 && <button className="btn btn-outline" onClick={() => { setQuery(""); setFilter("All projects"); }}>Clear filters</button>}{!tasks.length && !error && <Link to="/creator/new" className="btn btn-primary">Create a project<ArrowUpRight size={16} aria-hidden="true" /></Link>}</div>
          : <div className="project-table-scroll"><table className="responsive-records project-table"><thead><tr><th>Project</th><th>Status</th><th>Delivery</th><th>Budget</th><th>Created</th><th><span className="sr-only">Open project</span></th></tr></thead><tbody>{filtered.map(task => {
            const status = statusOf(task); const done = task.subtasks.filter(s => s.state === "VERIFIED").length; const total = task.subtasks.length;
            return <tr key={task.taskId}><td><Link className="project-name" to={`/task/${task.taskId}`}>{taskHeadlineText(task)}</Link><span className="project-id">{task.taskId.slice(0, 10)}…{task.taskId.slice(-4)}</span></td><td data-label="Status"><span className={`project-status status-${status.toLowerCase().replace(" ", "-")}`}><i />{status}</span></td><td data-label="Delivery"><div className="delivery-progress"><progress aria-label={`${done} of ${total} tasks verified`} value={done} max={Math.max(1,total)} /><span>{done}/{total}</span></div></td><td data-label="Budget" className="budget-value">{Number(task.budget).toLocaleString(undefined,{maximumFractionDigits:4})} <span>{currency}</span></td><td data-label="Created" className="project-date">{new Date(task.createdAt).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})}</td><td><Link className="project-open" to={`/task/${task.taskId}`} aria-label={`Open ${taskHeadlineText(task)}`}><ArrowUpRight size={18} /></Link></td></tr>;
          })}</tbody></table></div>}
      </section>
      <p className="overview-footnote">Project status reflects the latest indexed on-chain activity.</p>
    </div>
  );
}
