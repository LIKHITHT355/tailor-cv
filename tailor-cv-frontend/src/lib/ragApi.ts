export type FactBankStatus = "none" | "processing" | "ready" | "failed";

export type FactBank = {
  status: FactBankStatus;
  hash?: string;
  counts?: Record<string, number>;
  totalChunks?: number;
  embeddingModel?: string;
  updatedAt?: string | Date;
  warnings?: string[];
  error?: string | null;
};

export type SectionChunk = {
  id: string;
  text: string;
  section?: string;
  source?: string;
  entryIndex?: number;
  part?: number;
};

export type SectionResult = {
  section: string;
  count: number;
  chunks: SectionChunk[];
};

export type SearchMatch = {
  id: string;
  text: string;
  section: string;
  source?: string;
  score: number;
};

export type SearchResult = {
  matches: SearchMatch[];
};

const nodeApiUrl = (import.meta.env["VITE_NODE_API_URL"] || "http://localhost:5001").replace(/\/$/, "");

async function ragFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${nodeApiUrl}${path}`;
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (_err) {
    const portMatch = nodeApiUrl.match(/:(\d+)$/);
    const port = portMatch ? portMatch[1] : "5001";
    throw new Error(`Node API not reachable on :${port}`);
  }

  let body: any = null;
  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    try {
      body = await response.json();
    } catch {
      // ignore
    }
  }

  if (!response.ok) {
    const errorMsg =
      body?.error || body?.message || response.statusText || "Request failed";
    throw new Error(`HTTP ${response.status}: ${errorMsg}`);
  }

  return body as T;
}

export async function ingestFactBank(docId: string, force = false): Promise<FactBank> {
  return ragFetch<FactBank>(
    `/api/fact-bank/${encodeURIComponent(docId)}${force ? "?force=true" : ""}`,
    { method: "POST" }
  );
}

export async function getFactBankStatus(docId: string): Promise<FactBank> {
  return ragFetch<FactBank>(`/api/fact-bank/${encodeURIComponent(docId)}/status`);
}

export async function getSectionChunks(docId: string, section: string): Promise<SectionResult> {
  return ragFetch<SectionResult>(
    `/api/fact-bank/${encodeURIComponent(docId)}/section/${encodeURIComponent(section)}`
  );
}

export async function searchFactBank(
  docId: string,
  q: string,
  sections: string[],
  topK = 5
): Promise<SearchResult> {
  const params = new URLSearchParams({
    q,
    sections: sections.join(","),
    topK: String(topK),
  });
  return ragFetch<SearchResult>(
    `/api/fact-bank/${encodeURIComponent(docId)}/search?${params.toString()}`
  );
}
