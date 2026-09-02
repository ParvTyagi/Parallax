import JSZip from "jszip";

/// One entry inside an uploaded archive. `path` is the path as stored in the zip.
export interface ArchiveEntry {
  path: string;
  size: number;
  dir: boolean;
}

export interface ArchiveManifest {
  entries: ArchiveEntry[];
  entryCount: number;
  uncompressedSize: number;
  truncated: boolean;
}

/// A zip's local file header always starts with "PK\x03\x04". Empty archives use
/// "PK\x05\x06". Sniffing the bytes is more reliable than trusting the browser's
/// mimetype, which varies by OS and is absent for some uploads.
export function looksLikeZip(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  return (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)
  );
}

/// Caps the manifest so a zip bomb (millions of tiny entries) can't blow up the
/// response or the DB row. The archive itself is still stored in full.
const MAX_MANIFEST_ENTRIES = 2000;

export async function readArchiveManifest(buffer: Buffer): Promise<ArchiveManifest | null> {
  if (!looksLikeZip(buffer)) return null;

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    // Sniffed as a zip but won't parse — treat it as an opaque binary rather than
    // failing the whole upload.
    return null;
  }

  const entries: ArchiveEntry[] = [];
  let uncompressedSize = 0;
  let total = 0;

  zip.forEach((path, file) => {
    total++;
    const size = Number((file as any)._data?.uncompressedSize ?? 0);
    if (!file.dir) uncompressedSize += size;
    if (entries.length < MAX_MANIFEST_ENTRIES) {
      entries.push({ path, size: file.dir ? 0 : size, dir: file.dir });
    }
  });

  entries.sort((a, b) => a.path.localeCompare(b.path));

  return {
    entries,
    entryCount: total,
    uncompressedSize,
    truncated: total > entries.length
  };
}

/// Extracts a single file from an archive so a worker can preview one CSV instead
/// of downloading a multi-hundred-megabyte bundle.
export async function extractArchiveEntry(
  buffer: Buffer,
  entryPath: string
): Promise<Buffer | null> {
  if (!looksLikeZip(buffer)) return null;
  try {
    const zip = await JSZip.loadAsync(buffer);
    const file = zip.file(entryPath);
    if (!file || file.dir) return null;
    return await file.async("nodebuffer");
  } catch {
    return null;
  }
}
