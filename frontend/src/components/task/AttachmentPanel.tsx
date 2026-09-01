import { useEffect, useState } from "react";
import { Download, FolderArchive, FileText, ChevronDown, AlertTriangle } from "lucide-react";
import { API_URL } from "../../lib/constants";
import { formatBytes } from "./AttachmentUploader";

interface ArchiveEntry {
  path: string;
  size: number;
  dir: boolean;
}

interface Attachment {
  cid: string;
  filename: string;
  mimetype: string;
  size: number;
  isArchive: boolean;
  entryCount?: number | null;
  uncompressedSize?: number | null;
  entries?: ArchiveEntry[] | null;
  truncated?: boolean;
  ephemeral?: boolean;
}

/// Pulls dataset CIDs out of a task description.
///
/// The attachment reference is written into the pinned master brief as an
/// `ipfs://<cid>` URI, because the contract has no field for it — the on-chain
/// description is a single CID and adding an attachments array would mean a
/// contract migration.
export function extractAttachmentCids(description?: string | null): string[] {
  if (!description) return [];
  const matches = description.matchAll(/ipfs:\/\/([A-Za-z0-9]{20,})/g);
  return [...new Set([...matches].map((m) => m[1]))];
}

export function AttachmentPanel({ cid }: { cid: string }) {
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFiles, setShowFiles] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/ipfs/attachment/${cid}`);
        if (res.ok && !cancelled) setAttachment(await res.json());
      } catch {
        // Metadata is best-effort; the download link below still works without it.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cid]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 text-xs text-base-content/40">
        <span className="loading loading-spinner loading-xs" />
        Loading attachment…
      </div>
    );
  }

  const files = (attachment?.entries || []).filter((e) => !e.dir);

  return (
    <div className="rounded-lg border border-base-300/60 bg-base-200/40 overflow-hidden">
      <div className="flex items-center gap-2.5 p-3">
        {attachment?.isArchive ? (
          <FolderArchive className="w-4 h-4 text-primary shrink-0" />
        ) : (
          <FileText className="w-4 h-4 text-primary shrink-0" />
        )}

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-base-content truncate">
            {attachment?.filename || "Attached dataset"}
          </p>
          <p className="text-[11px] text-base-content/50 font-mono truncate">
            {attachment ? formatBytes(attachment.size) : "size unknown"}
            {files.length > 0 ? ` · ${files.length} files` : ""}
            {attachment?.uncompressedSize
              ? ` · ${formatBytes(attachment.uncompressedSize)} unpacked`
              : ""}
            {` · ${cid.slice(0, 10)}…`}
          </p>
        </div>

        <a
          href={`${API_URL}/api/ipfs/file/${cid}`}
          className="btn btn-neutral btn-xs gap-1 shrink-0"
          download
        >
          <Download className="w-3 h-3" />
          Download
        </a>
      </div>

      {attachment?.ephemeral && (
        <div className="flex items-start gap-1.5 px-3 pb-2 text-[11px] text-warning">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
          <span>
            This file is held in backend memory only and will be lost when the backend restarts.
          </span>
        </div>
      )}

      {files.length > 0 && (
        <div className="border-t border-base-300/60">
          <button
            type="button"
            onClick={() => setShowFiles((v) => !v)}
            className="w-full flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-base-content/40 hover:text-base-content/70 transition-colors"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${showFiles ? "rotate-180" : ""}`} />
            Browse contents
          </button>

          {showFiles && (
            <div className="max-h-56 overflow-y-auto divide-y divide-base-300/40 border-t border-base-300/40">
              {files.map((entry) => (
                <div key={entry.path} className="flex items-center gap-2 px-3 py-1.5">
                  <FileText className="w-3 h-3 text-base-content/30 shrink-0" />
                  <span className="text-[11px] text-base-content/70 truncate flex-1 font-mono">
                    {entry.path}
                  </span>
                  <span className="text-[10px] font-mono text-base-content/35 shrink-0">
                    {formatBytes(entry.size)}
                  </span>
                  {/* Pull a single file out of the archive rather than the whole bundle. */}
                  <a
                    href={`${API_URL}/api/ipfs/archive/${cid}/entry?path=${encodeURIComponent(entry.path)}`}
                    className="btn btn-ghost btn-xs btn-square shrink-0"
                    download
                    aria-label={`Download ${entry.path}`}
                  >
                    <Download className="w-3 h-3" />
                  </a>
                </div>
              ))}
              {attachment?.truncated && (
                <p className="px-3 py-2 text-[11px] italic text-base-content/40">
                  Listing truncated — download the archive to see every file.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/// Renders every dataset referenced by a task description.
export function TaskAttachments({ description }: { description?: string | null }) {
  const cids = extractAttachmentCids(description);
  if (cids.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-base-content/40">
        Attached datasets
      </p>
      {cids.map((cid) => (
        <AttachmentPanel key={cid} cid={cid} />
      ))}
    </div>
  );
}
