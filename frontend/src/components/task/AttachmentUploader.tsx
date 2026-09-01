import { useId, useRef, useState } from "react";
import { UploadCloud, FileText, X, FolderArchive, Loader2, AlertCircle } from "lucide-react";
import { API_URL } from "../../lib/constants";

export interface UploadedAttachment {
  cid: string;
  filename: string;
  mimetype: string;
  size: number;
  isArchive: boolean;
  entryCount?: number | null;
  uncompressedSize?: number | null;
  ephemeral?: boolean;
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/// Anything at or above this gets zipped even when it's a single file — below it,
/// compressing costs more in browser time than it saves on the wire.
const ZIP_THRESHOLD_BYTES = 2 * 1024 * 1024;

/// Mirrors the backend's MAX_UPLOAD_MB default. Checked here so an oversized
/// bundle fails with an explanation instead of a bare 413 after a long upload.
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

const isAlreadyCompressed = (file: File) =>
  /\.(zip|gz|tgz|bz2|xz|7z|rar|jpg|jpeg|png|gif|webp|mp4|mov|mp3|pdf)$/i.test(file.name);

const filePath = (f: File) => (f as any).webkitRelativePath || f.name;
const fileKey = (f: File) => `${filePath(f)}:${f.size}:${f.lastModified}`;

interface Props {
  attachment: UploadedAttachment | null;
  onChange: (attachment: UploadedAttachment | null) => void;
  disabled?: boolean;
}

/// Dataset attachment picker. Bundles many files (or a folder) into one zip in
/// the browser, so a large corpus is a single request with a readable manifest.
export function AttachmentUploader({ attachment, onChange, disabled }: Props) {
  const [staged, setStaged] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ label: string; percent: number } | null>(null);
  const [error, setError] = useState("");
  const [isDropTarget, setIsDropTarget] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const listId = useId();

  const stagedBytes = staged.reduce((sum, f) => sum + f.size, 0);
  const willZip =
    staged.length > 1 ||
    (staged.length === 1 && !isAlreadyCompressed(staged[0]) && stagedBytes >= ZIP_THRESHOLD_BYTES);
  const locked = Boolean(disabled) || busy;

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const incoming = Array.from(list);
    setStaged((prev) => {
      const seen = new Set(prev.map(fileKey));
      const next = [...prev];
      let skipped = 0;
      for (const f of incoming) {
        if (seen.has(fileKey(f))) {
          skipped++;
          continue;
        }
        seen.add(fileKey(f));
        next.push(f);
      }
      // Silently ignoring a re-picked file looks like the picker is broken.
      setError(
        skipped > 0
          ? `${skipped} file${skipped === 1 ? " is" : "s are"} already in the list and ${
              skipped === 1 ? "was" : "were"
            } skipped.`
          : ""
      );
      return next;
    });
  };

  /// A file input keeps its previous value, so re-picking a file you just removed
  /// fires no change event at all. Clearing the value makes that work.
  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    e.target.value = "";
  };

  const removeStaged = (index: number) => {
    setError("");
    setStaged((prev) => prev.filter((_, i) => i !== index));
  };

  const clearStaged = () => {
    setError("");
    setStaged([]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (locked) return;
    e.preventDefault();
    setIsDropTarget(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDropTarget(false);
    if (locked) return;
    addFiles(e.dataTransfer.files);
  };

  const handleUpload = async () => {
    if (staged.length === 0) return;
    setBusy(true);
    setError("");

    try {
      let payload: Blob;
      let filename: string;

      if (willZip) {
        setProgress({ label: "Compressing…", percent: 0 });
        // Loaded on demand: JSZip is ~105 KB and most tasks ship no attachment.
        const { default: JSZip } = await import("jszip");
        const zip = new JSZip();
        for (const file of staged) {
          // webkitRelativePath preserves folder structure for directory picks.
          zip.file(filePath(file), file);
        }
        payload = await zip.generateAsync(
          { type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } },
          (meta) => setProgress({ label: "Compressing…", percent: Math.round(meta.percent) })
        );
        filename =
          staged.length === 1
            ? `${staged[0].name.replace(/\.[^.]+$/, "")}.zip`
            : `dataset-${new Date().toISOString().slice(0, 10)}.zip`;
      } else {
        payload = staged[0];
        filename = staged[0].name;
      }

      // Checked after compression, because that is the size actually sent.
      if (payload.size > MAX_UPLOAD_BYTES) {
        throw new Error(
          `This bundle is ${formatBytes(payload.size)}, over the ${formatBytes(
            MAX_UPLOAD_BYTES
          )} limit. Remove some files and upload the rest separately.`
        );
      }

      setProgress({ label: "Uploading to IPFS…", percent: 100 });
      const formData = new FormData();
      formData.append("file", payload, filename);

      const res = await fetch(`${API_URL}/api/ipfs/upload-file`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      onChange(data as UploadedAttachment);
      setStaged([]);
    } catch (e: any) {
      setError(e?.message || "Upload failed");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  if (attachment) {
    return (
      <div className="flex items-center gap-2.5 p-3 bg-base-200/60 rounded-lg border border-base-300">
        {attachment.isArchive ? (
          <FolderArchive aria-hidden="true" className="w-4 h-4 text-primary shrink-0" />
        ) : (
          <FileText aria-hidden="true" className="w-4 h-4 text-primary shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-base-content truncate">{attachment.filename}</p>
          <p className="text-[11px] text-base-content/60 font-mono">
            {formatBytes(attachment.size)}
            {attachment.isArchive && attachment.entryCount ? ` · ${attachment.entryCount} files` : ""}
            {attachment.uncompressedSize
              ? ` · ${formatBytes(attachment.uncompressedSize)} uncompressed`
              : ""}
          </p>
          {attachment.ephemeral && (
            <p className="text-[11px] text-warning mt-0.5">
              Held in temporary storage — this file may not survive a server restart.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={disabled}
          className="btn btn-ghost btn-xs btn-square"
          aria-label={`Remove attachment ${attachment.filename}`}
        >
          <X aria-hidden="true" className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="space-y-2"
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDropTarget(false)}
      onDrop={handleDrop}
    >
      {staged.length === 0 ? (
        <div className="flex gap-2">
          {/* The input is sr-only rather than hidden: display:none drops it out of
              the tab order, leaving no way to attach a file by keyboard. */}
          <label
            className={`flex-1 flex flex-col items-center justify-center gap-1.5 p-4 border border-dashed rounded-lg transition-colors focus-within:ring-2 focus-within:ring-primary focus-within:border-primary ${
              locked
                ? "border-base-300 opacity-60 cursor-not-allowed"
                : isDropTarget
                  ? "border-primary bg-primary/5 cursor-pointer"
                  : "border-base-300 hover:border-base-content/40 hover:bg-base-200/40 cursor-pointer"
            }`}
          >
            <UploadCloud aria-hidden="true" className="w-5 h-5 text-base-content/60" />
            <span className="text-xs text-base-content/60 font-medium">
              {isDropTarget ? "Drop to add" : "Choose files"}
            </span>
            <span className="text-[10px] text-base-content/60">
              or drag them here · multiple files are zipped automatically
            </span>
            <input
              ref={fileInput}
              type="file"
              multiple
              className="sr-only"
              disabled={locked}
              onChange={handlePick}
            />
          </label>
          <label
            className={`flex flex-col items-center justify-center gap-1.5 p-4 px-5 border border-dashed rounded-lg transition-colors focus-within:ring-2 focus-within:ring-primary focus-within:border-primary ${
              locked
                ? "border-base-300 opacity-60 cursor-not-allowed"
                : "border-base-300 hover:border-base-content/40 hover:bg-base-200/40 cursor-pointer"
            }`}
          >
            <FolderArchive aria-hidden="true" className="w-5 h-5 text-base-content/60" />
            <span className="text-xs text-base-content/60 font-medium">Folder</span>
            <input
              type="file"
              className="sr-only"
              disabled={locked}
              // Non-standard but supported in every major browser; the cast keeps TS happy.
              {...({ webkitdirectory: "", directory: "" } as any)}
              onChange={handlePick}
            />
          </label>
        </div>
      ) : (
        <div
          className={`border rounded-lg overflow-hidden transition-colors ${
            isDropTarget ? "border-primary bg-primary/5" : "border-base-300"
          }`}
        >
          <ul id={listId} className="max-h-40 overflow-y-auto divide-y divide-base-300/60">
            {staged.map((f, i) => (
              <li key={fileKey(f)} className="flex items-center gap-2 px-3 py-2 bg-base-200/40">
                <FileText aria-hidden="true" className="w-3.5 h-3.5 text-base-content/60 shrink-0" />
                <span className="text-xs text-base-content/80 truncate flex-1">{filePath(f)}</span>
                <span className="text-[11px] font-mono text-base-content/60 shrink-0">
                  {formatBytes(f.size)}
                </span>
                <button
                  type="button"
                  onClick={() => removeStaged(i)}
                  disabled={busy}
                  className="btn btn-ghost btn-xs btn-square"
                  aria-label={`Remove ${filePath(f)} from the upload`}
                >
                  <X aria-hidden="true" className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-base-300 bg-base-100">
            <span className="text-[11px] text-base-content/60 font-mono">
              {staged.length} file{staged.length === 1 ? "" : "s"} · {formatBytes(stagedBytes)}
              {willZip && " · will be zipped"}
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={clearStaged}
                disabled={busy}
                className="btn btn-ghost btn-xs"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={busy}
                aria-controls={listId}
                className="btn btn-ghost btn-xs"
              >
                Add more
              </button>
              {/* Driven by the button above, so it is kept out of the tab order. */}
              <input
                ref={fileInput}
                type="file"
                multiple
                tabIndex={-1}
                aria-hidden="true"
                className="sr-only"
                onChange={handlePick}
              />
              <button
                type="button"
                onClick={handleUpload}
                disabled={busy || disabled}
                className="btn btn-neutral btn-xs gap-1"
              >
                {busy ? (
                  <Loader2
                    aria-hidden="true"
                    className="w-3 h-3 animate-spin motion-reduce:animate-none"
                  />
                ) : (
                  <UploadCloud aria-hidden="true" className="w-3 h-3" />
                )}
                {busy ? "Uploading…" : "Upload"}
              </button>
            </div>
          </div>

          {progress && (
            <div className="px-3 py-2 border-t border-base-300 bg-base-100 space-y-1">
              <div className="flex justify-between text-[11px] text-base-content/60">
                <span id={`${listId}-progress`}>{progress.label}</span>
                <span className="font-mono">{progress.percent}%</span>
              </div>
              <progress
                aria-labelledby={`${listId}-progress`}
                className="progress progress-primary w-full h-1"
                value={progress.percent}
                max={100}
              />
            </div>
          )}
        </div>
      )}

      {/* Staging changes and upload progress are otherwise silent for screen readers. */}
      <p role="status" aria-live="polite" className="sr-only">
        {progress
          ? `${progress.label} ${progress.percent}%`
          : staged.length > 0
            ? `${staged.length} file${staged.length === 1 ? "" : "s"} ready to upload, ${formatBytes(
                stagedBytes
              )} total.`
            : ""}
      </p>

      {error && (
        <p role="alert" className="text-xs text-error flex items-start gap-1.5">
          <AlertCircle aria-hidden="true" className="w-3.5 h-3.5 shrink-0 mt-px" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
