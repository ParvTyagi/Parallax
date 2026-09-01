import { useRef, useState } from "react";
import { UploadCloud, FileText, X, FolderArchive, Loader2 } from "lucide-react";
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

const isAlreadyCompressed = (file: File) =>
  /\.(zip|gz|tgz|bz2|xz|7z|rar|jpg|jpeg|png|gif|webp|mp4|mov|mp3|pdf)$/i.test(file.name);

interface Props {
  attachment: UploadedAttachment | null;
  onChange: (attachment: UploadedAttachment | null) => void;
  disabled?: boolean;
}

/// Dataset attachment picker.
///
/// Accepts many files (or a whole folder) and bundles them into one zip in the
/// browser before upload. That keeps large corpora to a single request, cuts the
/// bytes on the wire, and gives the backend one CID with a readable manifest
/// instead of an opaque blob a worker can't open.
export function AttachmentUploader({ attachment, onChange, disabled }: Props) {
  const [staged, setStaged] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ label: string; percent: number } | null>(null);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const stagedBytes = staged.reduce((sum, f) => sum + f.size, 0);
  const willZip = staged.length > 1 || (staged.length === 1 && !isAlreadyCompressed(staged[0]) && stagedBytes >= ZIP_THRESHOLD_BYTES);

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    setError("");
    setStaged((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      const next = [...prev];
      for (const f of Array.from(list)) {
        if (!seen.has(`${f.name}:${f.size}`)) next.push(f);
      }
      return next;
    });
  };

  const removeStaged = (index: number) => setStaged((prev) => prev.filter((_, i) => i !== index));

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
          // webkitRelativePath preserves folder structure when a directory was
          // picked; it's empty for individually chosen files.
          const path = (file as any).webkitRelativePath || file.name;
          zip.file(path, file);
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
          <FolderArchive className="w-4 h-4 text-primary shrink-0" />
        ) : (
          <FileText className="w-4 h-4 text-primary shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-base-content truncate">{attachment.filename}</p>
          <p className="text-[11px] text-base-content/50 font-mono">
            {formatBytes(attachment.size)}
            {attachment.isArchive && attachment.entryCount ? ` · ${attachment.entryCount} files` : ""}
            {attachment.uncompressedSize
              ? ` · ${formatBytes(attachment.uncompressedSize)} uncompressed`
              : ""}
          </p>
          {attachment.ephemeral && (
            <p className="text-[11px] text-warning mt-0.5">
              Stored in backend memory only — set PINATA_JWT for durable pinning.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={disabled}
          className="btn btn-ghost btn-xs btn-square"
          aria-label="Remove attachment"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {staged.length === 0 ? (
        <div className="flex gap-2">
          <label className="flex-1 flex flex-col items-center justify-center gap-1.5 p-4 border border-dashed border-base-300 rounded-lg cursor-pointer hover:border-base-content/40 hover:bg-base-200/40 transition-colors">
            <UploadCloud className="w-5 h-5 text-base-content/40" />
            <span className="text-xs text-base-content/60 font-medium">Choose files</span>
            <span className="text-[10px] text-base-content/40">Multiple files are zipped automatically</span>
            <input
              ref={fileInput}
              type="file"
              multiple
              className="hidden"
              disabled={disabled}
              onChange={(e) => addFiles(e.target.files)}
            />
          </label>
          <label className="flex flex-col items-center justify-center gap-1.5 p-4 px-5 border border-dashed border-base-300 rounded-lg cursor-pointer hover:border-base-content/40 hover:bg-base-200/40 transition-colors">
            <FolderArchive className="w-5 h-5 text-base-content/40" />
            <span className="text-xs text-base-content/60 font-medium">Folder</span>
            <input
              ref={folderInput}
              type="file"
              className="hidden"
              disabled={disabled}
              // Non-standard but supported in every major browser; the cast keeps TS happy.
              {...({ webkitdirectory: "", directory: "" } as any)}
              onChange={(e) => addFiles(e.target.files)}
            />
          </label>
        </div>
      ) : (
        <div className="border border-base-300 rounded-lg overflow-hidden">
          <div className="max-h-40 overflow-y-auto divide-y divide-base-300/60">
            {staged.map((f, i) => (
              <div key={`${f.name}-${i}`} className="flex items-center gap-2 px-3 py-2 bg-base-200/40">
                <FileText className="w-3.5 h-3.5 text-base-content/40 shrink-0" />
                <span className="text-xs text-base-content/80 truncate flex-1">
                  {(f as any).webkitRelativePath || f.name}
                </span>
                <span className="text-[11px] font-mono text-base-content/40 shrink-0">
                  {formatBytes(f.size)}
                </span>
                <button
                  type="button"
                  onClick={() => removeStaged(i)}
                  disabled={busy}
                  className="btn btn-ghost btn-xs btn-square"
                  aria-label={`Remove ${f.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-base-300 bg-base-100">
            <span className="text-[11px] text-base-content/50 font-mono">
              {staged.length} file{staged.length === 1 ? "" : "s"} · {formatBytes(stagedBytes)}
              {willZip && " · will be zipped"}
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={busy}
                className="btn btn-ghost btn-xs"
              >
                Add more
              </button>
              <input
                ref={fileInput}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
              <button
                type="button"
                onClick={handleUpload}
                disabled={busy || disabled}
                className="btn btn-neutral btn-xs gap-1"
              >
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <UploadCloud className="w-3 h-3" />}
                Upload
              </button>
            </div>
          </div>

          {progress && (
            <div className="px-3 py-2 border-t border-base-300 bg-base-100 space-y-1">
              <div className="flex justify-between text-[11px] text-base-content/50">
                <span>{progress.label}</span>
                <span className="font-mono">{progress.percent}%</span>
              </div>
              <progress className="progress progress-primary w-full h-1" value={progress.percent} max={100} />
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}
