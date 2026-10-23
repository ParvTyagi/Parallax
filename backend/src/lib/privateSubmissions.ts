type SubmissionRecord = {
  id: string;
  subtask_id: string;
  worker: string;
  content: string;
  content_hash: string;
};

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configure SUPABASE_URL and SUPABASE_SECRET_KEY for submissions.");
  return { url, key };
}

function apiHeaders(key: string, prefer?: string): HeadersInit {
  return {
    apikey: key,
    ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}),
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {})
  };
}

export async function storePrivateSubmission(record: SubmissionRecord): Promise<void> {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/private_submissions`, {
    method: "POST",
    headers: apiHeaders(key, "return=minimal"),
    body: JSON.stringify(record)
  });
  if (!response.ok) throw new Error(`Could not save submission to Supabase (${response.status}).`);
}

export async function getPrivateSubmission(id: string): Promise<string | null> {
  const { url, key } = config();
  const query = new URLSearchParams({ id: `eq.${id}`, select: "content", limit: "1" });
  const response = await fetch(`${url}/rest/v1/private_submissions?${query}`, {
    headers: apiHeaders(key)
  });
  if (!response.ok) throw new Error(`Could not load submission from Supabase (${response.status}).`);
  const rows = await response.json() as Array<{ content: string }>;
  return rows[0]?.content ?? null;
}

export async function deletePrivateSubmission(id: string): Promise<void> {
  const { url, key } = config();
  const query = new URLSearchParams({ id: `eq.${id}` });
  const response = await fetch(`${url}/rest/v1/private_submissions?${query}`, {
    method: "DELETE",
    headers: apiHeaders(key, "return=minimal")
  });
  if (!response.ok) throw new Error(`Could not clean up submission in Supabase (${response.status}).`);
}
