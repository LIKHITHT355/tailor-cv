import { Pinecone } from "@pinecone-database/pinecone";
import { env } from "../config/env.js";

let pinecone;

export function getNamespace(docId) {
  if (typeof docId !== "string" || !docId.trim()) throw new TypeError("docId must be a non-empty string");
  return docId;
}

function getIndex(docId) {
  pinecone ??= new Pinecone({ apiKey: env.pineconeApiKey });
  return pinecone.index(env.pineconeIndex).namespace(getNamespace(docId));
}

function batches(items, size) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

export function extractNumericStatus(err) {
  if (!err) return undefined;
  if (typeof err.status === "number") return err.status;
  if (typeof err.statusCode === "number") return err.statusCode;
  if (typeof err.cause?.status === "number") return err.cause.status;
  if (typeof err.response?.status === "number") return err.response.status;
  if (err.name === "PineconeNotFoundError") return 404;
  if (err.name === "PineconeBadRequestError") return 400;
  if (err.name === "PineconeAuthorizationError") return 401;
  if (err.name === "PineconeConflictError") return 409;
  if (err.name === "PineconeInternalServerError") return 500;
  if (typeof err.message === "string") {
    const match = err.message.match(/HTTP (?:status )?(\d+)/i);
    if (match) {
      const code = Number(match[1]);
      if (Number.isInteger(code)) return code;
    }
  }
  return undefined;
}

export function namespaceNotFound(error) {
  if (!error) return false;
  if (error.name === "PineconeNotFoundError") return true;
  if (error.status === 404 || error.statusCode === 404) return true;
  const msg = error.message ?? "";
  return /namespace.*not found/i.test(msg) || /HTTP (?:status )?404\b/i.test(msg);
}

export function sanitizeMetadata(metadata = {}, text = "") {
  const allowedKeys = ["docId", "section", "entryIndex", "part", "source"];
  const sanitized = {};

  if (text !== undefined && text !== null) {
    sanitized.text = String(text);
  }

  for (const key of allowedKeys) {
    const val = metadata[key];
    if (val === null || val === undefined) {
      continue;
    }
    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
      sanitized[key] = val;
    } else if (Array.isArray(val)) {
      sanitized[key] = val.map(String);
    } else {
      sanitized[key] = String(val);
    }
  }

  for (const [key, val] of Object.entries(metadata)) {
    if (allowedKeys.includes(key) || key === "text") continue;
    if (val === null || val === undefined) continue;
    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
      sanitized[key] = val;
    } else if (Array.isArray(val)) {
      sanitized[key] = val.map(String);
    } else {
      sanitized[key] = String(val);
    }
  }

  return sanitized;
}

export async function upsertChunks(docId, chunksWithVectors) {
  if (!Array.isArray(chunksWithVectors)) throw new TypeError("chunksWithVectors must be an array");
  for (const chunk of chunksWithVectors) {
    if (!Array.isArray(chunk.vector) || chunk.vector.length !== 1024) {
      throw new RangeError("Each chunk vector must have length 1024");
    }
  }
  const index = getIndex(docId);
  try {
    for (const batch of batches(chunksWithVectors, 100)) {
      await index.upsert({
        records: batch.map(({ id, text, metadata, vector }) => ({
          id,
          values: vector,
          metadata: sanitizeMetadata(metadata, text),
        })),
      });
    }
  } catch (error) {
    const status = extractNumericStatus(error);
    if (status) error.status = status;
    throw error;
  }
}

export async function clearNamespace(docId) {
  try {
    await getIndex(docId).deleteAll();
  } catch (error) {
    if (!namespaceNotFound(error)) {
      const status = extractNumericStatus(error);
      if (status) error.status = status;
      throw error;
    }
  }
}

async function listIds(index, prefix) {
  const ids = [];
  let paginationToken;
  do {
    const page = await index.listPaginated({ prefix, paginationToken });
    ids.push(...(page.vectors ?? []).map((vector) => vector.id));
    paginationToken = page.pagination?.next;
  } while (paginationToken);
  return ids;
}

async function fetchRecords(index, ids) {
  const records = [];
  for (const batch of batches(ids, 100)) {
    if (!batch.length) continue;
    const response = await index.fetch({ ids: batch });
    records.push(...Object.values(response.records));
  }
  return records;
}

function publicRecord(record) {
  const metadata = record.metadata ?? {};
  return {
    id: record.id,
    text: metadata.text,
    section: metadata.section,
    entryIndex: metadata.entryIndex,
    part: metadata.part,
    source: metadata.source,
  };
}

export async function fetchSection(docId, section) {
  try {
    const index = getIndex(docId);
    const [resumeIds, addonIds] = await Promise.all([
      listIds(index, `${docId}:${section}:`),
      listIds(index, `${docId}:addon-${section}:`),
    ]);
    const [resume, addons] = await Promise.all([
      fetchRecords(index, resumeIds),
      fetchRecords(index, addonIds),
    ]);
    const byEntryThenPart = (a, b) => (a.metadata?.entryIndex ?? 0) - (b.metadata?.entryIndex ?? 0)
      || (a.metadata?.part ?? 0) - (b.metadata?.part ?? 0);
    return [...resume.sort(byEntryThenPart), ...addons.sort(byEntryThenPart)].map(publicRecord);
  } catch (error) {
    const status = extractNumericStatus(error);
    if (status) error.status = status;
    throw error;
  }
}

export async function searchSections(docId, queryVector, sections, topK) {
  if (!Array.isArray(queryVector) || queryVector.length !== 1024) {
    throw new RangeError("queryVector must have length 1024");
  }
  if (!Array.isArray(sections) || sections.length === 0) throw new TypeError("sections must be a non-empty array");
  try {
    const response = await getIndex(docId).query({
      vector: queryVector,
      topK,
      filter: { section: { $in: sections } },
      includeMetadata: true,
    });
    return response.matches.map((match) => ({
      id: match.id,
      text: match.metadata?.text,
      section: match.metadata?.section,
      source: match.metadata?.source,
      score: match.score,
    }));
  } catch (error) {
    const status = extractNumericStatus(error);
    if (status) error.status = status;
    throw error;
  }
}
