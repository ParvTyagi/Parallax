import { Router } from "express";
import multer from "multer";
import {
  pinToIPFS,
  pinFileBufferToIPFS,
  fetchBinaryFromIPFS,
  hasPinataCredentials,
  mockIpfsStore
} from "../lib/ipfs";
import { readArchiveManifest, extractArchiveEntry, looksLikeZip } from "../lib/archive";
import { prisma } from "../db/client";
export { mockIpfsStore };

const router = Router();

/// Uploads are buffered in memory, so this ceiling bounds one request's cost.
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB || 100) * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 }
});

router.post("/upload", async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    const cid = await pinToIPFS(content);
    console.log(`[IPFS] Pinned content: ${cid}`);

    res.json({ cid });
  } catch (error) {
    console.error("IPFS Upload Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/// Uploads one file. For a zip, the manifest is persisted so workers can see
/// what is inside and pull a single entry without downloading the archive.
router.post("/upload-file", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { buffer, originalname, mimetype } = req.file;
    const manifest = await readArchiveManifest(buffer);
    const isArchive = manifest !== null;

    // Zips uploaded from a browser arrive with wildly inconsistent mimetypes
    // (application/zip, application/x-zip-compressed, or nothing at all).
    const resolvedMime = isArchive ? "application/zip" : mimetype || "application/octet-stream";

    const cid = await pinFileBufferToIPFS(buffer, originalname, resolvedMime);
    const ephemeral = !hasPinataCredentials();

    const record = {
      filename: originalname,
      mimetype: resolvedMime,
      size: buffer.length,
      isArchive,
      entryCount: manifest?.entryCount ?? null,
      uncompressedSize: manifest?.uncompressedSize ?? null,
      entries: (manifest?.entries ?? null) as any,
      truncated: manifest?.truncated ?? false,
      ephemeral
    };

    await prisma.attachment.upsert({
      where: { cid },
      update: record,
      create: { cid, ...record }
    });

    console.log(
      `[IPFS] Pinned ${isArchive ? "archive" : "file"} ${originalname} ` +
        `(${buffer.length} bytes${manifest ? `, ${manifest.entryCount} entries` : ""}): ${cid}`
    );

    res.json({ cid, ...record });
  } catch (error) {
    console.error("IPFS File Upload Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/// Attachment metadata + archive manifest. Cheap enough to call from a task page
/// to render a file tree without transferring the archive itself.
router.get("/attachment/:cid", async (req, res) => {
  try {
    const { cid } = req.params;
    const attachment = await prisma.attachment.findUnique({ where: { cid } });
    if (!attachment) return res.status(404).json({ error: "Attachment not found" });
    res.json(attachment);
  } catch (error) {
    console.error("Attachment lookup error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/// Streams the attachment bytes back.
router.get("/file/:cid", async (req, res) => {
  try {
    const { cid } = req.params;
    const stored = await fetchBinaryFromIPFS(cid);
    if (!stored) {
      return res.status(404).json({
        error: "File not available. It may have been stored in memory only and lost on restart."
      });
    }

    const attachment = await prisma.attachment.findUnique({ where: { cid } });
    const filename = attachment?.filename || stored.filename || cid;

    res.setHeader("Content-Type", attachment?.mimetype || stored.mimetype);
    res.setHeader("Content-Length", String(stored.buffer.length));
    // Stripped: a raw filename could inject extra header directives.
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename.replace(/[^\w.\- ]/g, "_")}"`
    );
    res.send(stored.buffer);
  } catch (error) {
    console.error("IPFS file fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/// Extracts one entry from an archive, so a worker can preview a single CSV
/// without pulling the whole bundle.
router.get("/archive/:cid/entry", async (req, res) => {
  try {
    const { cid } = req.params;
    const entryPath = String(req.query.path || "");
    if (!entryPath) return res.status(400).json({ error: "A `path` query parameter is required" });

    const stored = await fetchBinaryFromIPFS(cid);
    if (!stored) return res.status(404).json({ error: "Archive not available" });
    if (!looksLikeZip(stored.buffer)) {
      return res.status(400).json({ error: "This attachment is not an archive" });
    }

    const entry = await extractArchiveEntry(stored.buffer, entryPath);
    if (!entry) return res.status(404).json({ error: "Entry not found in archive" });

    const safeName = entryPath.split("/").pop() || "entry";
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", String(entry.length));
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName.replace(/[^\w.\- ]/g, "_")}"`
    );
    res.send(entry);
  } catch (error) {
    console.error("Archive entry extraction error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/// Multer's own error class, which would otherwise surface as a generic 500.
router.use((err: any, _req: any, res: any, next: any) => {
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      error: `File exceeds the ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB upload limit. Zip and split it, or raise MAX_UPLOAD_MB.`
    });
  }
  return next(err);
});

export default router;
