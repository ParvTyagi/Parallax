import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useWeb3 } from "../../contexts/Web3Context";
import { API_URL } from "../../lib/constants";
import { taskHeadline, taskHeadlineText, MISSING_BRIEF_HINT } from "../../lib/utils";
import { ArrowUpRight, Plus, Search } from "lucide-react";

type SubtaskState = "CREATED" | "CLAIMED" | "SUBMITTED" | "PENDING_RELEASE" | "IN_DISPUTE" | "VERIFIED" | "REJECTED";

interface SubtaskRow {
  subtaskId: string;
  state: SubtaskState;
}

interface TaskRow {
  taskId: string;
  /// Resolved from the on-chain CID by the API; empty when that lookup fails.
  description: string;
  objective?: string | null;
  budget: string;
  createdAt: string;
  subtasks: SubtaskRow[];
}

function deriveTaskStatus(subtasks: SubtaskRow[]): { label: string; dotClass: string } {
  if (subtasks.length === 0) return { label: "Draft", dotClass: "bg-zinc-300" };
  if (subtasks.some((s) => s.state === "IN_DISPUTE")) return { label: "In dispute", dotClass: "bg-red-500" };
  if (subtasks.every((s) => s.state === "VERIFIED")) return { label: "Completed", dotClass: "bg-zinc-900" };
  if (subtasks.some((s) => s.state === "PENDING_RELEASE")) return { label: "Awaiting release", dotClass: "bg-amber-500" };
  if (subtasks.some((s) => s.state === "SUBMITTED")) return { label: "In review", dotClass: "bg-blue-500" };
  return { label: "Active", dotClass: "bg-emerald-500" };
}

export default function CreatorDashboard() {
  const { account, connectWallet } = useWeb3();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!account) {
      setTasks([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/tasks/customer/${account}`);
        if (res.ok && !cancelled) setTasks(await res.json());
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [account]);

  const filtered = useMemo(
    () => tasks.filter((t) => taskHeadlineText(t).toLowerCase().includes(query.toLowerCase())),
    [tasks, query]
  );

  const totals = useMemo(() => {
    const escrowed = tasks.reduce((sum, t) => sum + Number(t.budget || 0), 0);
    const active = tasks.filter((t) => !t.subtasks.every((s) => s.state === "VERIFIED")).length;
    const disputed = tasks.filter((t) => t.subtasks.some((s) => s.state === "IN_DISPUTE")).length;
    return { escrowed, active, disputed };
  }, [tasks]);

  return (
    <div className="min-h-screen bg-white text-zinc-950">
      <header className="border-b border-zinc-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-sm font-semibold tracking-tight">Parallax</span>
          {!account ? (
            <button
              onClick={connectWallet}
              className="rounded-md bg-zinc-900 px-3.5 py-2 text-xs font-medium text-zinc-50 hover:bg-zinc-800"
            >
              Connect Wallet
            </button>
          ) : (
            <span className="rounded-md border border-zinc-200 px-3 py-1.5 font-mono text-xs text-zinc-500">
              {account.slice(0, 6)}…{account.slice(-4)}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-zinc-500">Active tasks and escrow balances across your projects.</p>
          </div>
          <Link
            to="/creator/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3.5 py-2 text-xs font-medium text-zinc-50 hover:bg-zinc-800"
          >
            <Plus className="h-3.5 w-3.5" />
            New task
          </Link>
        </div>

        <div className="mb-8 grid grid-cols-3 divide-x divide-zinc-200 rounded-lg border border-zinc-200">
          <div className="p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Escrowed</div>
            <div className="mt-1.5 font-mono text-2xl font-medium">{totals.escrowed.toFixed(2)} <span className="text-sm text-zinc-500">MON</span></div>
          </div>
          <div className="p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Active tasks</div>
            <div className="mt-1.5 font-mono text-2xl font-medium">{totals.active}</div>
          </div>
          <div className="p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">In dispute</div>
            <div className="mt-1.5 font-mono text-2xl font-medium">{totals.disputed}</div>
          </div>
        </div>

        <div className="mb-4 flex items-center">
          <div className="relative w-full max-w-xs">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              id="creator-task-filter"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter tasks…"
              aria-label="Filter tasks by description"
              className="w-full rounded-md border border-zinc-200 py-1.5 pl-8 pr-3 text-xs placeholder:text-zinc-500 focus:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-zinc-200">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-2.5 font-medium">Task</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Progress</th>
                <th className="px-4 py-2.5 font-medium">Escrow</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
                <th className="w-8 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {!account ? (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center text-sm text-zinc-500">
                    Connect your wallet to view your tasks.
                  </td>
                </tr>
              ) : loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center text-sm text-zinc-500">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center text-sm text-zinc-500">
                    No tasks match your filter.
                  </td>
                </tr>
              ) : (
                filtered.map((task) => {
                  const status = deriveTaskStatus(task.subtasks);
                  const verified = task.subtasks.filter((s) => s.state === "VERIFIED").length;
                  const total = task.subtasks.length;
                  const headline = taskHeadline(task);
                  return (
                    <tr key={task.taskId} className="group hover:bg-zinc-50">
                      <td
                        className={`max-w-xs truncate px-4 py-3 ${
                          headline.isPlaceholder ? "italic font-normal text-zinc-500" : "font-medium"
                        }`}
                        title={headline.isPlaceholder ? MISSING_BRIEF_HINT : undefined}
                      >
                        {headline.text}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-600">
                          <span className={`h-1.5 w-1.5 rounded-full ${status.dotClass}`} />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1 w-20 overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className="h-full rounded-full bg-zinc-900"
                              style={{ width: `${total > 0 ? (verified / total) * 100 : 0}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs text-zinc-500">{verified}/{total}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{Number(task.budget).toFixed(2)} MON</td>
                      <td className="px-4 py-3 text-xs text-zinc-500">
                        {new Date(task.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/workspace/${task.taskId}`}>
                          <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5 text-zinc-500 group-hover:text-zinc-900" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
