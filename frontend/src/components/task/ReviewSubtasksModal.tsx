import { useEffect, useState } from "react";
import { Plus, X, AlertTriangle } from "lucide-react";
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
  description: string;
  descriptionCID?: string;
  reward: string;
  leaseDuration: number;
  isEdited: boolean;
  isManual: boolean;
}

interface IncomingSubtask {
  rangeLabel: string;
  description: string;
  descriptionCID: string;
  reward: number;
  leaseDuration: number;
}

interface ReviewSubtasksModalProps {
  open: boolean;
  masterTask: string;
  masterTaskCID: string;
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
  budget,
  subtasks,
  onConfirm,
  onCancel,
}: ReviewSubtasksModalProps) {
  const [rows, setRows] = useState<DraftSubtask[]>([]);

  useEffect(() => {
    if (open) {
      setRows(
        subtasks.map((st) => ({
          id: makeId(),
          rangeLabel: st.rangeLabel,
          description: st.description,
          descriptionCID: st.descriptionCID,
          reward: String(st.reward),
          leaseDuration: st.leaseDuration,
          isEdited: false,
          isManual: false,
        }))
      );
    }
  }, [open, subtasks]);

  const updateRow = (id: string, patch: Partial<DraftSubtask>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: makeId(),
        rangeLabel: "",
        description: "",
        descriptionCID: undefined,
        reward: "",
        leaseDuration: 1800,
        isEdited: true,
        isManual: true,
      },
    ]);
  };

  const totalReward = rows.reduce((sum, r) => sum + (parseFloat(r.reward) || 0), 0);
  const budgetNum = Number(budget) || 0;
  const overBudget = totalReward > budgetNum + 1e-9;
  const hasInvalidRow = rows.some(
    (r) =>
      !r.rangeLabel.trim() ||
      !r.description.trim() ||
      !(parseFloat(r.reward) > 0) ||
      !(r.leaseDuration > 0)
  );
  const isEmpty = rows.length === 0;
  const canConfirm = !overBudget && !hasInvalidRow && !isEmpty;

  let validationMessage = "";
  if (isEmpty) validationMessage = "Add at least one subtask before confirming.";
  else if (overBudget) validationMessage = "Total reward exceeds your original budget.";
  else if (hasInvalidRow)
    validationMessage = "Every subtask needs a label, description, positive reward, and lease duration.";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review Subtask Decomposition</DialogTitle>
          <DialogDescription>
            The AI split "{masterTask.slice(0, 90)}{masterTask.length > 90 ? "…" : ""}" into
            the subtasks below. Edit anything before it goes on-chain — nothing is submitted
            until you confirm.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <div key={row.id} className="card card-bordered bg-base-200/40 p-3 relative">
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                className="btn btn-ghost btn-xs btn-square absolute right-2 top-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Remove subtask"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              <input
                type="text"
                value={row.rangeLabel}
                onChange={(e) => updateRow(row.id, { rangeLabel: e.target.value })}
                placeholder="Subtask label"
                className="input input-bordered input-sm w-full mb-2 pr-8 font-medium"
              />

              <textarea
                value={row.description}
                onChange={(e) => updateRow(row.id, { description: e.target.value, isEdited: true })}
                placeholder="What should the worker do?"
                rows={2}
                className="textarea textarea-bordered textarea-sm w-full mb-2"
              />

              <div className="flex flex-wrap gap-3">
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
              </div>
            </div>
          ))}

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
