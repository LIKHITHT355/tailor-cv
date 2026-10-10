export type DocumentSummary = {
  id: string;
  filename: string;
  page_count: number;
  created_at: string;
};
export type ExtractedDocument = { id: string; filename: string; page_count: number; text: string };
export type Addon = {
  section: "skills" | "certification" | "experience" | "project";
  text: string;
};

export type DocumentWithLinks = ExtractedDocument & {
  links: { linkedin?: string | null; github?: string | null; other?: string[] };
  addons?: Addon[];
};

const configuredApiUrl = import.meta.env["VITE_API_URL"];

export class UnexpectedApiResponseError extends Error {
  readonly friendlyMessage =
    "Server returned an unexpected response. Check that the backend is running and VITE_API_URL is correct.";
}

function getApiUrl(): string {
  if (!configuredApiUrl) {
    throw new Error(
      "VITE_API_URL is not configured. Set it to the Flask gateway URL, for example http://localhost:5000.",
    );
  }
  return configuredApiUrl.replace(/\/$/, "");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getApiUrl()}${path}`;
  const response = await fetch(url, init);
  const isJson = response.headers.get("content-type")?.includes("application/json") ?? false;
  const unexpectedResponse = async (): Promise<UnexpectedApiResponseError> =>
    new UnexpectedApiResponseError(
      `Unexpected response (${response.status}) from ${url}: ${(await response.text()).slice(0, 100)}`,
    );
  if (!response.ok) {
    if (!isJson) throw await unexpectedResponse();
    const body: unknown = await response.json();
    const message =
      typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
        ? body.error
        : "Request failed";
    throw new Error(message);
  }
  if (!isJson) throw await unexpectedResponse();
  return response.json() as Promise<T>;
}

export async function extractResume(file: File): Promise<ExtractedDocument> {
  const form = new FormData();
  form.append("file", file);
  return request<ExtractedDocument>("/api/extract", { method: "POST", body: form });
}

export function analyzeResume(_resumeText: string, _jobDescription: string): Promise<never> {
  return Promise.reject(new Error("Not implemented"));
}
export function tailorResume(_resumeText: string, _jobDescription: string): Promise<never> {
  return Promise.reject(new Error("Not implemented"));
}
export function validateResume(_resumeText: string): Promise<never> {
  return Promise.reject(new Error("Not implemented"));
}
export function downloadResume(_resumeText: string): Promise<never> {
  return Promise.reject(new Error("Not implemented"));
}
export function listDocuments(): Promise<DocumentSummary[]> {
  return request<DocumentSummary[]>("/api/documents");
}
export function getDocument(id: string): Promise<DocumentWithLinks> {
  return request<DocumentWithLinks>(`/api/documents/${encodeURIComponent(id)}`);
}
export async function deleteDocument(id: string): Promise<void> {
  await request<{ deleted: boolean }>(`/api/documents/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
type LinkInput = { linkedin: string; github: string; other: string[] };
type SavedDetails = {
  links: { linkedin: string | null; github: string | null; other: string[] };
  addons: Addon[];
};

function saveDocumentDetails(
  id: string,
  details: Partial<LinkInput> & { addons?: Addon[] },
): Promise<SavedDetails> {
  return request<SavedDetails>(`/api/documents/${encodeURIComponent(id)}/links`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(details),
  });
}

export function saveLinks(id: string, links: LinkInput): Promise<SavedDetails> {
  return saveDocumentDetails(id, links);
}

export function saveAddons(id: string, addons: Addon[]): Promise<SavedDetails> {
  return saveDocumentDetails(id, { addons });
}
