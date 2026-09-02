import crypto from "crypto";
import { prisma } from "../db/client";

// Persistent in-memory cache for IPFS hashes (text content only).
export const mockIpfsStore = new Map<string, string>();

/// Binary fallback store. Kept separate from the text cache because coercing
/// bytes through a string corrupts any archive round-tripped through it.
export interface StoredBinary {
  buffer: Buffer;
  mimetype: string;
  filename: string;
}
export const mockIpfsBinaryStore = new Map<string, StoredBinary>();

/// True when the bytes for this CID only exist in this process's memory, so they
/// will not survive a restart and are not reachable from any IPFS gateway.
export function isEphemeral(cid: string): boolean {
  return mockIpfsBinaryStore.has(cid) && !hasPinataCredentials();
}

export function hasPinataCredentials(): boolean {
  return Boolean(
    process.env.PINATA_JWT || (process.env.PINATA_API_KEY && process.env.PINATA_SECRET_API_KEY)
  );
}

function gateways(): string[] {
  return [
    process.env.IPFS_GATEWAY,
    "https://gateway.pinata.cloud/ipfs/",
    "https://cloudflare-ipfs.com/ipfs/",
    "https://ipfs.io/ipfs/"
  ].filter(Boolean) as string[];
}

/// Fetches raw bytes for a CID — used for dataset attachments, which are usually
/// archives and must never be coerced through a string.
export async function fetchBinaryFromIPFS(cid: string): Promise<StoredBinary | null> {
  if (!cid) return null;

  const cached = mockIpfsBinaryStore.get(cid);
  if (cached) return cached;

  for (const gateway of gateways()) {
    try {
      const cleanGateway = gateway.endsWith("/") ? gateway : `${gateway}/`;
      // Archives can be large; allow far longer than a text fetch.
      const response = await fetch(`${cleanGateway}${cid}`, { signal: AbortSignal.timeout(60000) });
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        const stored: StoredBinary = {
          buffer,
          mimetype: response.headers.get("content-type") || "application/octet-stream",
          filename: cid
        };
        mockIpfsBinaryStore.set(cid, stored);
        return stored;
      }
    } catch {
      // Gateway failed, try next.
    }
  }

  return null;
}

function generateMockCID(content: string | Buffer): string {
  const hash = crypto.createHash("sha256").update(content).digest("hex");
  return "Qm" + hash.slice(0, 44);
}

/// Persists a pinned blob so it survives a restart and a dead gateway.
/// Best-effort: losing the durable copy must never fail the pin itself.
async function cacheTextDurably(cid: string, content: string): Promise<void> {
  if (!cid || content === undefined || content === null) return;
  try {
    await prisma.ipfsText.upsert({
      where: { cid },
      update: { content },
      create: { cid, content }
    });
  } catch (e) {
    console.warn(`[IPFS] Failed to persist durable copy of ${cid}:`, e);
  }
}

/// Resolves a CID to its text, in order of increasing cost:
/// in-process cache -> durable DB copy -> public gateways -> the SpecDraft
/// markdown stored against the CID at decompose time (recovers tasks pinned
/// before the durable cache existed).
///
/// Returns "" when the content genuinely cannot be resolved. It must never
/// return the CID itself: callers render this as a description and feed it to
/// the verifier, and a bare CID there is worse than nothing.
export async function fetchFromIPFS(cid: string): Promise<string> {
  if (!cid) return "";

  const cached = mockIpfsStore.get(cid);
  if (cached !== undefined) return cached;

  try {
    const row = await prisma.ipfsText.findUnique({ where: { cid } });
    if (row?.content) {
      mockIpfsStore.set(cid, row.content);
      return row.content;
    }
  } catch (e) {
    console.warn(`[IPFS] Durable cache lookup failed for ${cid}:`, e);
  }

  for (const gateway of gateways()) {
    try {
      const cleanGateway = gateway.endsWith("/") ? gateway : `${gateway}/`;
      const url = `${cleanGateway}${cid}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (response.ok) {
        const text = await response.text();
        mockIpfsStore.set(cid, text);
        await cacheTextDurably(cid, text);
        return text;
      }
    } catch {
      // Gateway failed, try next
    }
  }

  // Last resort: the structured spec saved against this CID at decompose time
  // still holds the exact markdown that was pinned.
  try {
    const draft = await prisma.specDraft.findUnique({ where: { cid } });
    if (draft?.markdown) {
      mockIpfsStore.set(cid, draft.markdown);
      await cacheTextDurably(cid, draft.markdown);
      console.log(`[IPFS] Recovered ${cid} from its stored spec draft`);
      return draft.markdown;
    }
  } catch (e) {
    console.warn(`[IPFS] Spec draft recovery failed for ${cid}:`, e);
  }

  console.warn(`[IPFS] Could not resolve ${cid} from cache, database, or any gateway`);
  return "";
}

export async function pinToIPFS(content: string): Promise<string> {
  const apiKey = process.env.PINATA_API_KEY;
  const secretKey = process.env.PINATA_SECRET_API_KEY;
  const jwt = process.env.PINATA_JWT;

  if ((apiKey && secretKey) || jwt) {
    try {
      const blob = new Blob([content], { type: "text/plain" });
      const formData = new FormData();
      formData.append("file", blob, "content.txt");

      const headers: Record<string, string> = {};
      if (jwt) {
        headers["Authorization"] = `Bearer ${jwt}`;
      } else if (apiKey && secretKey) {
        headers["pinata_api_key"] = apiKey;
        headers["pinata_secret_api_key"] = secretKey;
      }

      const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers,
        body: formData as any,
        signal: AbortSignal.timeout(8000)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.IpfsHash) {
          mockIpfsStore.set(data.IpfsHash, content);
          await cacheTextDurably(data.IpfsHash, content);
          console.log(`[IPFS] Pinned content to Pinata: ${data.IpfsHash}`);
          return data.IpfsHash;
        }
      } else {
        console.warn(`[IPFS] Pinata upload returned status ${response.status}. Using fallback CID.`);
      }
    } catch (pinataErr) {
      console.warn("[IPFS] Pinata upload exception, falling back to local CID:", pinataErr);
    }
  }

  // Resilient fallback: a deterministic local CID. It is not resolvable from any
  // gateway, so the durable copy below is the only thing that keeps the text
  // readable after this process exits.
  const cid = generateMockCID(content);
  mockIpfsStore.set(cid, content);
  await cacheTextDurably(cid, content);
  console.log(`[IPFS] Stored content locally with CID: ${cid}`);
  return cid;
}

export async function pinFileBufferToIPFS(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
  const apiKey = process.env.PINATA_API_KEY;
  const secretKey = process.env.PINATA_SECRET_API_KEY;
  const jwt = process.env.PINATA_JWT;

  if ((apiKey && secretKey) || jwt) {
    try {
      const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
      const formData = new FormData();
      formData.append("file", blob, filename);

      const headers: Record<string, string> = {};
      if (jwt) {
        headers["Authorization"] = `Bearer ${jwt}`;
      } else if (apiKey && secretKey) {
        headers["pinata_api_key"] = apiKey;
        headers["pinata_secret_api_key"] = secretKey;
      }

      const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        headers,
        body: formData as any,
        // Scaled with size (assumes a pessimistic 512 KB/s); a fixed budget
        // silently drops large attachments to the in-memory fallback.
        signal: AbortSignal.timeout(Math.min(300000, Math.max(30000, buffer.length / 512)))
      });

      if (response.ok) {
        const data = await response.json();
        if (data.IpfsHash) {
          mockIpfsBinaryStore.set(data.IpfsHash, { buffer, mimetype: mimeType, filename });
          console.log(`[IPFS] Pinned file ${filename} to Pinata: ${data.IpfsHash}`);
          return data.IpfsHash;
        }
      } else {
        console.warn(`[IPFS] Pinata file upload returned status ${response.status}. Using fallback CID.`);
      }
    } catch (pinataErr) {
      console.warn("[IPFS] Pinata file upload exception, falling back to local CID:", pinataErr);
    }
  }

  const cid = generateMockCID(buffer);
  mockIpfsBinaryStore.set(cid, { buffer, mimetype: mimeType, filename });
  console.log(`[IPFS] Stored file ${filename} locally with CID: ${cid} (in-memory only)`);
  return cid;
}
