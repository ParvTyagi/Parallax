import { Router } from "express";
import multer from "multer";
import { pinToIPFS, pinFileBufferToIPFS, mockIpfsStore } from "../lib/ipfs";
export { mockIpfsStore };

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/upload", async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }

    const cid = await pinToIPFS(content);
    console.log(`[IPFS] Pinned content to Pinata: ${cid}`);

    res.json({ cid });
  } catch (error) {
    console.error("IPFS Upload Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/upload-file", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const cid = await pinFileBufferToIPFS(req.file.buffer, req.file.originalname, req.file.mimetype);
    console.log(`[IPFS] Pinned file ${req.file.originalname} to Pinata: ${cid}`);

    res.json({ cid, filename: req.file.originalname, mimetype: req.file.mimetype });
  } catch (error) {
    console.error("IPFS File Upload Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
