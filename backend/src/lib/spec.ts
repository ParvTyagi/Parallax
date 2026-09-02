import { prisma } from "../db/client";

/// A subtask spec as the orchestrator produces it and as the UI edits it.
/// The contract only ever stores an IPFS CID for `description`, so the full
/// structure lives in `SpecDraft` (keyed by that CID) and is copied onto the
/// Subtask row when the SubtaskCreated event is indexed.
export interface SubtaskSpec {
  rangeLabel: string;
  objective: string;
  contextNotes?: string;
  steps?: string[];
  acceptanceCriteria: string[];
  deliverableFormat?: string;
  skills?: string[];
  estimatedMinutes?: number;
  reward: number;
  leaseDuration: number;
  /// Rendered markdown — this is what actually gets pinned and what a worker reads.
  description?: string;
  descriptionCID?: string;
}

export interface MasterSpec {
  objective: string;
  contextNotes?: string;
  successCriteria: string[];
}

const bullets = (items?: string[]) =>
  (items || []).filter((s) => String(s || "").trim()).map((s) => `- ${String(s).trim()}`).join("\n");

const numbered = (items?: string[]) =>
  (items || []).filter((s) => String(s || "").trim()).map((s, i) => `${i + 1}. ${String(s).trim()}`).join("\n");

/// Renders a worker-facing markdown brief. Everything a worker needs to decide
/// whether to claim, and everything the AI verifier will grade against, in one doc.
export function renderSubtaskSpecMarkdown(spec: SubtaskSpec, masterObjective?: string): string {
  const parts: string[] = [];

  parts.push(`# ${spec.rangeLabel || "Subtask"}`);
  parts.push("");
  parts.push("## Objective");
  parts.push(spec.objective?.trim() || spec.rangeLabel || "Complete the assigned work.");

  if (masterObjective?.trim()) {
    parts.push("");
    parts.push("## Part of");
    parts.push(masterObjective.trim());
  }

  if (spec.contextNotes?.trim()) {
    parts.push("");
    parts.push("## Context");
    parts.push(spec.contextNotes.trim());
  }

  const steps = numbered(spec.steps);
  if (steps) {
    parts.push("");
    parts.push("## Suggested approach");
    parts.push(steps);
  }

  const criteria = bullets(spec.acceptanceCriteria);
  if (criteria) {
    parts.push("");
    parts.push("## Acceptance criteria");
    parts.push("Your submission is graded against each of these. All must be met to pass.");
    parts.push("");
    parts.push(criteria);
  }

  if (spec.deliverableFormat?.trim()) {
    parts.push("");
    parts.push("## Deliverable format");
    parts.push(spec.deliverableFormat.trim());
  }

  const meta: string[] = [];
  if (spec.skills?.length) meta.push(`**Skills:** ${spec.skills.join(", ")}`);
  if (spec.estimatedMinutes) meta.push(`**Estimated effort:** ~${spec.estimatedMinutes} min`);
  if (spec.leaseDuration) meta.push(`**Lease window:** ${Math.round(spec.leaseDuration / 60)} min`);
  if (meta.length) {
    parts.push("");
    parts.push("---");
    parts.push(meta.join("  \n"));
  }

  return parts.join("\n");
}

export function renderMasterSpecMarkdown(masterTask: string, spec: MasterSpec): string {
  const parts: string[] = ["# Master Task", "", "## Objective", spec.objective?.trim() || masterTask];

  if (spec.contextNotes?.trim()) {
    parts.push("", "## Context", spec.contextNotes.trim());
  }

  const criteria = bullets(spec.successCriteria);
  if (criteria) {
    parts.push("", "## Definition of done", criteria);
  }

  parts.push("", "---", "## Original request", masterTask);
  return parts.join("\n");
}

/// Persists the structured spec so the chain listener can hydrate it later from
/// the CID alone. Never throws — a failed draft only costs us the rich fields.
export async function saveSpecDraft(
  cid: string,
  kind: "MASTER" | "SUBTASK",
  data: {
    title?: string;
    objective?: string;
    contextNotes?: string;
    acceptanceCriteria?: string[];
    deliverableFormat?: string;
    skills?: string[];
    estimatedMinutes?: number;
    markdown?: string;
  }
): Promise<void> {
  if (!cid) return;
  const payload = {
    kind,
    title: data.title ?? null,
    objective: data.objective ?? null,
    contextNotes: data.contextNotes ?? null,
    acceptanceCriteria: (data.acceptanceCriteria || []).filter(Boolean),
    deliverableFormat: data.deliverableFormat ?? null,
    skills: (data.skills || []).filter(Boolean),
    estimatedMinutes: data.estimatedMinutes ?? null,
    markdown: data.markdown ?? null
  };
  try {
    await prisma.specDraft.upsert({
      where: { cid },
      update: payload,
      create: { cid, ...payload }
    });
  } catch (e) {
    console.warn(`[Spec] Failed to persist spec draft for ${cid}:`, e);
  }
}

export async function getSpecDraft(cid: string) {
  if (!cid) return null;
  try {
    return await prisma.specDraft.findUnique({ where: { cid } });
  } catch {
    return null;
  }
}

/// Normalises whatever the LLM returned into a SubtaskSpec. The model is not
/// reliable about field names or types, so every field is coerced defensively.
export function coerceSubtaskSpec(raw: any, fallbackReward: number): SubtaskSpec {
  const arr = (v: any): string[] => {
    if (Array.isArray(v)) return v.map((x) => String(x)).filter((s) => s.trim());
    if (typeof v === "string" && v.trim()) return [v.trim()];
    return [];
  };

  const objective = String(raw?.objective || raw?.description || raw?.rangeLabel || "").trim();
  const criteria = arr(raw?.acceptanceCriteria ?? raw?.acceptance_criteria ?? raw?.criteria);

  return {
    rangeLabel: String(raw?.rangeLabel || raw?.label || "Subtask").trim(),
    objective,
    contextNotes: raw?.contextNotes ? String(raw.contextNotes).trim() : undefined,
    steps: arr(raw?.steps),
    // A spec with no criteria is unverifiable, so synthesise a minimum bar.
    acceptanceCriteria: criteria.length
      ? criteria
      : [
          "Deliverable directly addresses the stated objective.",
          "Output is complete — no placeholders, TODOs, or truncated sections.",
          "Claims are specific and supported rather than generic filler."
        ],
    deliverableFormat: raw?.deliverableFormat ? String(raw.deliverableFormat).trim() : "Markdown text.",
    skills: arr(raw?.skills).slice(0, 6),
    estimatedMinutes: Number(raw?.estimatedMinutes) > 0 ? Math.round(Number(raw.estimatedMinutes)) : undefined,
    reward: Number(raw?.reward) > 0 ? Number(raw.reward) : fallbackReward,
    leaseDuration:
      Number(raw?.leaseDuration) > 0 ? Math.round(Number(raw.leaseDuration)) : 1800
  };
}
