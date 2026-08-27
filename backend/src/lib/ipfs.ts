import { mockIpfsStore } from "../routes/ipfs";

export async function fetchFromIPFS(cid: string): Promise<string> {
  if (!cid) return "";
  
  if (mockIpfsStore.has(cid)) {
    console.log(`[IPFS Mock] Retrieved ${cid} from local mock store`);
    return mockIpfsStore.get(cid)!;
  }
  
  // For MVP, we use the public Cloudflare or IPFS.io gateway
  const gateway = process.env.IPFS_GATEWAY || "https://cloudflare-ipfs.com/ipfs/";
  const url = `${gateway}${cid}`;
  
  try {
    console.log(`[IPFS] Fetching ${cid} ...`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch IPFS CID ${cid}: ${response.statusText}`);
    }
    
    // We assume the content is text/JSON for now. 
    // In a real startup, we'd handle .zip extraction here.
    const text = await response.text();
    return text;
  } catch (err) {
    console.error("[IPFS] Fetch Error:", err);
    // Fallback: If it's not a valid CID or gateway fails, return the string itself 
    // (useful for testing backwards compatibility with plain text)
    return cid;
  }
}

export async function pinToIPFS(content: string): Promise<string> {
  const blob = new Blob([content], { type: "text/plain" });
  const formData = new FormData();
  formData.append("file", blob, "content.txt");

  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      pinata_api_key: process.env.PINATA_API_KEY!,
      pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY!
    },
    body: formData as any
  });

  if (!response.ok) {
    throw new Error(`Pinata upload failed: ${await response.text()}`);
  }

  const data = await response.json();
  return data.IpfsHash;
}

export async function pinFileBufferToIPFS(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
  const blob = new Blob([buffer], { type: mimeType });
  const formData = new FormData();
  formData.append("file", blob, filename);

  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      pinata_api_key: process.env.PINATA_API_KEY!,
      pinata_secret_api_key: process.env.PINATA_SECRET_API_KEY!
    },
    body: formData as any
  });

  if (!response.ok) {
    throw new Error(`Pinata upload failed: ${await response.text()}`);
  }

  const data = await response.json();
  return data.IpfsHash;
}
