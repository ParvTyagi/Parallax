import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/// A bare IPFS CID — CIDv0 (`Qm…`) or CIDv1 (`baf…`). Used to make sure a
/// pointer never gets rendered where a human-readable brief belongs.
const CID_PATTERN = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|Qm[0-9a-f]{44}|b[A-Za-z2-7]{40,})$/;

export function looksLikeCid(value?: string | null): boolean {
  return CID_PATTERN.test((value || "").trim());
}

/// Shown in place of a title when the brief behind the CID cannot be loaded.
/// Callers render it in a muted, italic style so it never reads as real content.
export const MISSING_BRIEF_LABEL = "Description unavailable";

/// Why the brief is missing, for a `title` tooltip / screen-reader description.
export const MISSING_BRIEF_HINT =
  "This task's description is stored on IPFS and could not be retrieved. The task itself and its escrow are unaffected.";

/// One-line title for a task in cards, tables, and headers.
///
/// The on-chain `description` is only an IPFS CID; the API resolves it to the
/// pinned markdown brief and leaves it empty when that lookup fails. So prefer
/// the structured objective, fall back to the first real line of the brief, and
/// never render a CID as if it were the description.
///
/// `isPlaceholder` tells the caller to style the result as absent content
/// rather than as a title.
export function taskHeadline(task: {
  objective?: string | null;
  description?: string | null;
}): { text: string; isPlaceholder: boolean } {
  const objective = task.objective?.trim();
  if (objective) return { text: objective, isPlaceholder: false };

  const raw = task.description || "";
  if (!looksLikeCid(raw)) {
    const firstLine = raw
      .replace(/^#.*$/gm, "")
      .replace(/^\s*Attached Dataset:.*$/gim, "")
      .replace(/[*_`>]/g, "")
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean);

    if (firstLine && !looksLikeCid(firstLine)) {
      return { text: firstLine, isPlaceholder: false };
    }
  }

  return { text: MISSING_BRIEF_LABEL, isPlaceholder: true };
}

/// Plain-string form, for search filters and other non-rendering callers.
export function taskHeadlineText(task: {
  objective?: string | null;
  description?: string | null;
}): string {
  return taskHeadline(task).text;
}
