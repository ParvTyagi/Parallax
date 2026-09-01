import { CheckCircle2, Circle, XCircle, FileText, Target, ChevronDown } from "lucide-react";

export interface CriterionResult {
  criterion: string;
  met: boolean;
  note?: string;
}

export interface SubtaskLike {
  rangeLabel?: string;
  /// Full markdown brief resolved from IPFS.
  description?: string;
  objective?: string | null;
  contextNotes?: string | null;
  acceptanceCriteria?: string[] | null;
  deliverableFormat?: string | null;
  skills?: string[] | null;
  estimatedMinutes?: number | null;
  criteriaResults?: CriterionResult[] | null;
  aiRationale?: string | null;
}

/// One-line summary for cards and lists.
///
/// `description` is now a full markdown brief, so rendering it directly puts
/// "# Phase 1" and heading noise into card titles. Prefer the structured
/// objective and fall back to stripping markdown out of the brief.
export function subtaskHeadline(st: SubtaskLike): string {
  if (st.objective?.trim()) return st.objective.trim();
  const raw = st.description || "";
  const objectiveSection = raw.match(/##\s*Objective\s*\n+([\s\S]*?)(?=\n##\s|$)/i);
  const body = (objectiveSection?.[1] || raw)
    .replace(/^#.*$/gm, "")
    .replace(/[*_`>-]/g, "")
    .trim();
  return body.split("\n").filter(Boolean)[0] || st.rangeLabel || "Subtask";
}

/// Acceptance criteria checklist. Before verification it's a plain list of the
/// bar the worker has to clear; afterwards each row shows the verifier's verdict
/// and reasoning, so a rejection is explainable rather than a bare score.
export function AcceptanceCriteria({ subtask }: { subtask: SubtaskLike }) {
  const criteria = subtask.acceptanceCriteria || [];
  const results = subtask.criteriaResults || [];
  if (criteria.length === 0 && results.length === 0) return null;

  const rows =
    results.length > 0
      ? results
      : criteria.map((criterion) => ({ criterion, met: false, note: "" }));
  const graded = results.length > 0;
  const metCount = rows.filter((r) => r.met).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-base-content/50">
        <span className="flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5" />
          Acceptance criteria
        </span>
        {graded && (
          <span
            className={`badge badge-xs font-mono font-bold ${
              metCount === rows.length ? "badge-success" : "badge-warning"
            }`}
          >
            {metCount}/{rows.length} met
          </span>
        )}
      </div>

      <ul className="space-y-1.5">
        {rows.map((row, i) => (
          <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
            {graded ? (
              row.met ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-error shrink-0 mt-0.5" />
              )
            ) : (
              <Circle className="w-3.5 h-3.5 text-base-content/30 shrink-0 mt-0.5" />
            )}
            <div>
              <span className={graded && !row.met ? "text-base-content/80" : "text-base-content/70"}>
                {row.criterion}
              </span>
              {graded && row.note && (
                <span className="block text-[11px] text-base-content/45 italic mt-0.5">{row.note}</span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {!graded && (
        <p className="text-[11px] text-base-content/40 italic">
          The AI verifier grades each of these independently. All must be met to release payment.
        </p>
      )}
    </div>
  );
}

/// Full worker-facing brief: objective, context, criteria, deliverable format,
/// and the raw markdown spec behind a disclosure.
export function SubtaskSpec({ subtask, showRawBrief = true }: { subtask: SubtaskLike; showRawBrief?: boolean }) {
  const headline = subtaskHeadline(subtask);
  const hasStructured =
    !!subtask.objective || (subtask.acceptanceCriteria?.length ?? 0) > 0 || !!subtask.deliverableFormat;

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-base-content leading-relaxed bg-base-200/40 p-3 rounded-lg border border-base-300/60">
        {headline}
      </div>

      {subtask.contextNotes && (
        <div className="text-xs text-base-content/60 leading-relaxed">
          <span className="font-bold uppercase tracking-wider text-[11px] text-base-content/50">Context: </span>
          {subtask.contextNotes}
        </div>
      )}

      <AcceptanceCriteria subtask={subtask} />

      {subtask.deliverableFormat && (
        <div className="flex items-start gap-1.5 text-xs text-base-content/60">
          <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5 text-base-content/40" />
          <span>
            <span className="font-semibold">Deliver as:</span> {subtask.deliverableFormat}
          </span>
        </div>
      )}

      {(subtask.skills?.length || subtask.estimatedMinutes) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {subtask.skills?.map((s) => (
            <span key={s} className="badge badge-outline badge-xs font-mono">{s}</span>
          ))}
          {subtask.estimatedMinutes ? (
            <span className="text-[11px] text-base-content/40 font-mono">~{subtask.estimatedMinutes} min</span>
          ) : null}
        </div>
      )}

      {subtask.aiRationale && (
        <div className="text-xs text-base-content/60 bg-base-200/40 p-2.5 rounded-lg border border-base-300/60 whitespace-pre-wrap leading-relaxed">
          <span className="font-bold uppercase tracking-wider text-[11px] text-base-content/50 block mb-1">
            Verifier rationale
          </span>
          {subtask.aiRationale}
        </div>
      )}

      {showRawBrief && subtask.description && hasStructured && (
        <details className="group">
          <summary className="cursor-pointer list-none text-[11px] font-bold uppercase tracking-wider text-base-content/40 hover:text-base-content/70 flex items-center gap-1">
            <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
            Full brief
          </summary>
          <pre className="mt-2 text-xs text-base-content/70 font-mono bg-base-200/40 p-3 rounded-lg border border-base-300/60 max-h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed">
            {subtask.description}
          </pre>
        </details>
      )}
    </div>
  );
}
