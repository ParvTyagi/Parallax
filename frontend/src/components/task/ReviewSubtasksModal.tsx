import { useEffect, useState } from "react";
import { Plus, X, AlertTriangle, ListChecks, ChevronDown, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "../ui/Dialog";

export interface DraftSubtask {
  id: string;
  rangeLabel: string;
  /// Rendered markdown brief that gets pinned to IPFS and read by the worker.
  description: string;
  descriptionCID?: string;
  /// Structured spec fields. These are what the AI verifier grades against, so
  /// they are editable here — the creator gets the last word on what "done" means.
  objective: string;
  contextNotes: string;
  acceptanceCriteria: string[];
  deliverableFormat: string;
  skills: string[];
  estimatedMinutes?: number;
  reward: string;
  leaseDuration: number;
  isEdited: boolean;
  isManual: boolean;
}

interface IncomingSubtask {
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
}

interface ReviewSubtasksModalProps {
  open: boolean;
  masterTask: string;
  masterTaskCID: string;
  masterObjective?: string;
  successCriteria?: string[];
  budget: string;
  subtasks: IncomingSubtask[];
  onConfirm: (result: { masterTaskCID: string; finalSubtasks: DraftSubtask[] }) => void;
  onCancel: () => void;
}

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `row-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function ReviewSubtasksModal({
  open,
  masterTask,
  masterTaskCID,
  masterObjective,
  successCriteria,
  budget,
  subtasks,
  onConfirm,
  onCancel,
}: ReviewSubtasksModalProps) {
  const [rows, setRows] = useState<DraftSubtask[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      setRows(
        subtasks.map((st) => ({
          id: makeId(),
          rangeLabel: st.rangeLabel,
          description: st.description || "",
          descriptionCID: st.descriptionCID,
          objective: st.objective || "",
          contextNotes: st.contextNotes || "",
          acceptanceCriteria: st.acceptanceCriteria || [],
          deliverableFormat: st.deliverableFormat || "",
          skills: st.skills || [],
          estimatedMinutes: st.estimatedMinutes,
          reward: String(st.reward),
          leaseDuration: st.leaseDuration,
          isEdited: false,
          isManual: false,
        }))
      );
      setExpanded({});
    }
  }, [open, subtasks]);

  const updateRow = (id: string, patch: Partial<DraftSubtask>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch, isEdited: true } : r)));
  };

  const removeRow = (id: string) => setRows((prev) => prev.filter((r) => r.id !== id));

  const updateCriterion = (id: string, index: number, value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const next = [...r.acceptanceCriteria];
        next[index] = value;
        return { ...r, acceptanceCriteria: next, isEdited: true };
      })
    );
  };

  const addCriterion = (id: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, acceptanceCriteria: [...r.acceptanceCriteria, ""], isEdited: true } : r
      )
    );
    setExpanded((prev) => ({ ...prev, [id]: true }));
  };

  const removeCriterion = (id: string, index: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, acceptanceCriteria: r.acceptanceCriteria.filter((_, i) => i !== index), isEdited: true }
          : r
      )
    );
  };

  const addRow = () => {
    const id = makeId();
    setRows((prev) => [
      ...prev,
      {
        id,
        rangeLabel: "",
        description: "",
        descriptionCID: undefined,
        objective: "",
        contextNotes: "",
        acceptanceCriteria: [""],
        deliverableFormat: "Markdown text.",
        skills: [],
        estimatedMinutes: undefined,
        reward: "",
        leaseDuration: 1800,
        isEdited: true,
        isManual: true,
      },
    ]);
    setExpanded((prev) => ({ ...prev, [id]: true }));
  };

  const totalReward = rows.reduce((sum, r) => sum + (parseFloat(r.reward) || 0), 0);
  const budgetNum = Number(budget) || 0;
  const overBudget = totalReward > budgetNum + 1e-9;
  const hasInvalidRow = rows.some(
    (r) =>
      !r.rangeLabel.trim() ||
      !r.objective.trim() ||
      !(parseFloat(r.reward) > 0) ||
      !(r.leaseDuration > 0)
  );
  // A subtask with no criteria can't be verified objectively, and a worker has no
  // way to know when they're done — so block it before it reaches the chain.
  const hasNoCriteria = rows.some((r) => r.acceptanceCriteria.filter((c) => c.trim()).length === 0);
  const isEmpty = rows.length === 0;
  const canConfirm = !overBudget && !hasInvalidRow && !hasNoCriteria && !isEmpty;

  let validationMessage = "";
  if (isEmpty) validationMessage = "Add at least one subtask before confirming.";
  else if (overBudget) validationMessage = "Total reward exceeds your original budget.";
  else if (hasInvalidRow)
    validationMessage = "Every subtask needs a label, an objective, a positive reward, and a lease duration.";
  else if (hasNoCriteria)
    validationMessage = "Every subtask needs at least one acceptance criterion — it's what the AI verifier grades against.";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review Subtask Decomposition</DialogTitle>
          <DialogDescription>
            The AI split "{masterTask.slice(0, 90)}{masterTask.length > 90 ? "…" : ""}" into
            the subtasks below. Acceptance criteria are what the verifier grades against and
            what decides payout — edit anything before it goes on-chain.
          </DialogDescription>
        </DialogHeader>

        {(masterObjective || (successCriteria && successCriteria.length > 0)) && (
          <div className="rounded-lg border border-base-300 bg-base-200/40 p-3 mb-4 text-sm">
            {masterObjective && (
              <>
                <div className="text-xs font-semibold uppercase tracking-wide text-base-content/50 mb-1">
                  Overall objective
                </div>
                <p className="text-base-content/80 leading-relaxed">{masterObjective}</p>
              </>
            )}
            {successCriteria && successCriteria.length > 0 && (
              <>
                <div className="text-xs font-semibold uppercase tracking-wide text-base-content/50 mt-3 mb-1">
                  Definition of done
                </div>
                <ul className="list-disc list-inside text-base-content/70 space-y-0.5">
                  {successCriteria.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {rows.map((row, rowIndex) => {
            const isOpen = expanded[row.id] ?? false;
            const criteriaCount = row.acceptanceCriteria.filter((c) => c.trim()).length;
            return (
              <div key={row.id} className="card card-bordered bg-base-200/40 p-3 relative">
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="btn btn-ghost btn-xs btn-square absolute right-2 top-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label="Remove subtask"
                >
                  <X className="h-3.5 w-3.5" />
                </button>

                <div className="flex items-center gap-2 mb-2 pr-8">
                  <span className="badge badge-neutral badge-sm font-mono">{rowIndex + 1}</span>
                  <input
                    type="text"
                    value={row.rangeLabel}
                    onChange={(e) => updateRow(row.id, { rangeLabel: e.target.value })}
                    placeholder="Subtask label"
                    className="input input-bordered input-sm w-full font-medium"
                  />
                </div>

                <label className="text-xs font-semibold uppercase tracking-wide text-base-content/50 mb-1 block">
                  Objective — what the worker must produce
                </label>
                <textarea
                  value={row.objective}
                  onChange={(e) => updateRow(row.id, { objective: e.target.value })}
                  placeholder="Be concrete about scope, quantity, and depth."
                  rows={3}
                  className="textarea textarea-bordered textarea-sm w-full mb-2"
                />

                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-base-content/50 flex items-center gap-1.5">
                    <ListChecks className="h-3.5 w-3.5" />
                    Acceptance criteria
                    <span
                      className={`badge badge-xs ${criteriaCount === 0 ? "badge-error" : "badge-ghost"}`}
                    >
                      {criteriaCount}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setExpanded((p) => ({ ...p, [row.id]: !isOpen }))}
                    className="btn btn-ghost btn-xs gap-1"
                  >
                    {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    {isOpen ? "Hide" : "Edit"}
                  </button>
                </div>

                {!isOpen && criteriaCount > 0 && (
                  <ul className="list-disc list-inside text-xs text-base-content/60 space-y-0.5 mb-2">
                    {row.acceptanceCriteria.filter((c) => c.trim()).map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                )}

                {isOpen && (
                  <div className="flex flex-col gap-1.5 mb-2">
                    {row.acceptanceCriteria.map((criterion, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={criterion}
                          onChange={(e) => updateCriterion(row.id, i, e.target.value)}
                          placeholder="Objectively checkable, e.g. 'cites at least 5 sources with URLs'"
                          className="input input-bordered input-xs w-full"
                        />
                        <button
                          type="button"
                          onClick={() => removeCriterion(row.id, i)}
                          className="btn btn-ghost btn-xs btn-square"
                          aria-label="Remove criterion"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addCriterion(row.id)}
                      className="btn btn-ghost btn-xs self-start gap-1"
                    >
                      <Plus className="h-3 w-3" /> Add criterion
                    </button>

                    <label className="text-xs font-semibold uppercase tracking-wide text-base-content/50 mt-2">
                      Deliverable format
                    </label>
                    <input
                      type="text"
                      value={row.deliverableFormat}
                      onChange={(e) => updateRow(row.id, { deliverableFormat: e.target.value })}
                      placeholder="e.g. Markdown report, 600-900 words, with a Sources section"
                      className="input input-bordered input-xs w-full"
                    />

                    <label className="text-xs font-semibold uppercase tracking-wide text-base-content/50 mt-2">
                      Context the worker can't guess (optional)
                    </label>
                    <textarea
                      value={row.contextNotes}
                      onChange={(e) => updateRow(row.id, { contextNotes: e.target.value })}
                      rows={2}
                      className="textarea textarea-bordered textarea-xs w-full"
                    />
                  </div>
                )}

                <div className="flex flex-wrap gap-3 items-center">
                  <label className="flex items-center gap-2 text-xs text-base-content/70">
                    Reward (MON)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.reward}
                      onChange={(e) => updateRow(row.id, { reward: e.target.value })}
                      className="input input-bordered input-sm w-28"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-base-content/70">
                    Lease (minutes)
                    <input
                      type="number"
                      min="1"
                      value={Math.round(row.leaseDuration / 60)}
                      onChange={(e) =>
                        updateRow(row.id, {
                          leaseDuration: Math.max(60, Math.round((parseFloat(e.target.value) || 0) * 60)),
                        })
                      }
                      className="input input-bordered input-sm w-20"
                    />
                    <span className="opacity-60">({row.leaseDuration}s)</span>
                  </label>
                  {row.skills.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {row.skills.map((s) => (
                        <span key={s} className="badge badge-outline badge-xs">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={addRow}
            className="btn btn-outline btn-sm self-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Plus className="h-4 w-4" /> Add subtask
          </button>
        </div>

        <div className="flex items-center justify-between mt-5 pt-3 border-t border-base-300 text-sm">
          <span className="text-base-content/70">
            Total: <span className="font-mono font-semibold text-base-content">{totalReward.toFixed(4)} MON</span>
            {" "}/ Budget: <span className="font-mono">{budgetNum.toFixed(4)} MON</span>
          </span>
          {overBudget && <span className="badge badge-error badge-sm">Over budget</span>}
        </div>

        {validationMessage && (
          <div className="alert alert-error mt-3 py-2 text-sm">
            <AlertTriangle className="h-4 w-4" />
            <span>{validationMessage}</span>
          </div>
        )}

        <DialogFooter>
          <button type="button" onClick={onCancel} className="btn btn-ghost">
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm({ masterTaskCID, finalSubtasks: rows })}
            className="btn btn-neutral"
          >
            Confirm &amp; Create Task
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
