import crypto from "node:crypto";
import { DOC_FIELDS } from "../config/fields.js";
import { MISTRAL_EMBED_MODEL, embedTexts } from "./embedder.js";
import * as chunkerService from "./chunker.js";
import * as vectorStoreService from "./vectorStore.js";
import * as defaultStore from "./factBankStore.js";

// FACT_BANK_VERSION: bump when chunker/embedding logic changes
export const FACT_BANK_VERSION = 1;

export const SIX_SECTIONS = [
  "header",
  "education",
  "experience",
  "certification",
  "skills",
  "project",
];

const VALID_ADDON_SECTIONS = new Set([
  "skills",
  "certification",
  "experience",
  "project",
]);

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.statusCode = status;
  }
}

export function computeHash(resumeText, addons) {
  const normalizedResume = (resumeText ?? "").replace(/\r\n/g, "\n").trim();
  const validAddons = [];
  if (Array.isArray(addons)) {
    for (const addon of addons) {
      if (
        addon &&
        typeof addon === "object" &&
        VALID_ADDON_SECTIONS.has(addon.section) &&
        typeof addon.text === "string" &&
        addon.text.trim()
      ) {
        validAddons.push({
          section: addon.section,
          text: addon.text.trim(),
        });
      }
    }
  }

  const payload = JSON.stringify({
    v: FACT_BANK_VERSION,
    model: MISTRAL_EMBED_MODEL,
    resume: normalizedResume,
    addons: validAddons,
  });

  return crypto.createHash("sha256").update(payload).digest("hex");
}

export function parseSearchQuery(query = {}) {
  const rawQ = query.q;
  if (typeof rawQ !== "string") {
    throw new HttpError(400, "Query 'q' is required and must be a string");
  }
  const q = rawQ.trim();
  if (q.length < 1 || q.length > 200) {
    throw new HttpError(400, "Query 'q' must be between 1 and 200 characters");
  }

  let sectionsCsv = query.sections;
  if (sectionsCsv === undefined || sectionsCsv === null || sectionsCsv === "") {
    sectionsCsv = "skills,project";
  }

  if (typeof sectionsCsv !== "string") {
    throw new HttpError(400, "sections must be a comma-separated string");
  }

  const parts = sectionsCsv.split(",").map((s) => s.trim()).filter(Boolean);
  const dedupedSections = [...new Set(parts)];
  if (dedupedSections.length === 0) {
    throw new HttpError(400, "At least one valid section must be provided");
  }

  const validSet = new Set(SIX_SECTIONS);
  for (const sec of dedupedSections) {
    if (!validSet.has(sec)) {
      throw new HttpError(400, `Invalid section '${sec}'. Allowed: ${SIX_SECTIONS.join(", ")}`);
    }
  }

  let topK = 5;
  if (query.topK !== undefined && query.topK !== null && query.topK !== "") {
    const parsed = Number(query.topK);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
      throw new HttpError(400, "topK must be an integer between 1 and 10");
    }
    topK = parsed;
  }

  return {
    q,
    query: q,
    sections: dedupedSections,
    secArray: dedupedSections,
    topK,
    k: topK,
  };
}

export async function runIngest(docId, options = {}, deps = {}) {
  const force = Boolean(options.force);
  const store = deps.store ?? defaultStore;
  const chunker = deps.chunker ?? chunkerService;
  const embed = deps.embedTexts ?? embedTexts;
  const vectorStore = deps.vectorStore ?? vectorStoreService;
  const nowFn = deps.now ?? (() => new Date());

  const startTime = Date.now();

  const doc = await store.getDoc(docId);
  if (!doc) {
    throw new HttpError(404, "Document not found");
  }

  const rawResumeText = doc[DOC_FIELDS.resumeText];
  if (typeof rawResumeText !== "string" || !rawResumeText.trim()) {
    throw new HttpError(400, "Resume text is missing or empty");
  }

  const rawAddons = doc[DOC_FIELDS.addons] ?? [];
  const hash = computeHash(rawResumeText, rawAddons);

  const storedFactBank = doc.factBank;
  if (!force && storedFactBank?.status === "ready" && storedFactBank?.hash === hash) {
    return { statusCode: 200, factBank: storedFactBank };
  }

  const claimSuccess = await store.claim(docId, nowFn(), 5 * 60 * 1000);
  if (!claimSuccess) {
    throw new HttpError(409, "Ingest already in progress");
  }

  let stage = "chunk";
  try {
    const warnings = [];
    const validAddonsWithRunningIndex = [];
    const runningIndexes = {
      skills: 0,
      certification: 0,
      experience: 0,
      project: 0,
    };

    if (Array.isArray(rawAddons)) {
      rawAddons.forEach((item, index) => {
        if (
          item &&
          typeof item === "object" &&
          VALID_ADDON_SECTIONS.has(item.section) &&
          typeof item.text === "string" &&
          item.text.trim()
        ) {
          const n = runningIndexes[item.section]++;
          validAddonsWithRunningIndex.push({
            section: item.section,
            text: item.text.trim(),
            n,
          });
        } else {
          warnings.push(`addon ${index} skipped`);
        }
      });
    }

    const resumeChunks = await chunker.chunkResume(docId, rawResumeText.trim());
    const addonChunkPromises = validAddonsWithRunningIndex.map((addon) =>
      chunker.chunkAddon(docId, addon.text, addon.section, addon.n)
    );
    const addonChunkArrays = await Promise.all(addonChunkPromises);
    const addonChunks = addonChunkArrays.flat();

    const allChunks = [...resumeChunks, ...addonChunks];

    const counts = {};
    for (const sec of SIX_SECTIONS) {
      counts[sec] = 0;
    }
    for (const ch of allChunks) {
      const sec = ch.metadata?.section;
      if (sec && counts[sec] !== undefined) {
        counts[sec] += 1;
      }
    }
    const totalChunks = allChunks.length;

    if (totalChunks === 0) {
      const err = new Error("No chunks generated");
      throw err;
    }

    if (counts.header === 0) warnings.push("no header chunks found");
    if (counts.education === 0) warnings.push("no education chunks found");
    if (counts.experience === 0) warnings.push("no experience chunks found");

    stage = "embed";
    const texts = allChunks.map((ch) => ch.text);
    const vectors = await embed(texts);
    if (!Array.isArray(vectors) || vectors.length !== allChunks.length) {
      throw new Error("Embedding length mismatch");
    }

    await store.setFactBank(docId, { updatedAt: nowFn() });

    stage = "clear";
    await vectorStore.clearNamespace(docId);

    stage = "upsert";
    const chunksWithVectors = allChunks.map((ch, idx) => ({
      ...ch,
      vector: vectors[idx],
    }));
    await vectorStore.upsertChunks(docId, chunksWithVectors);

    const readyFactBank = {
      status: "ready",
      hash,
      counts,
      totalChunks,
      embeddingModel: MISTRAL_EMBED_MODEL,
      updatedAt: nowFn(),
      warnings,
      error: null,
    };

    await store.setFactBank(docId, readyFactBank);

    const duration = Date.now() - startTime;
    console.log(
      `[INGEST] docId=${docId} status=ready totalChunks=${totalChunks} duration_ms=${duration}`
    );

    return { statusCode: 200, factBank: readyFactBank };
  } catch (err) {
    const code = err.status ?? err.statusCode;
    console.error({
      docId,
      stage,
      errName: err.name,
      errCode: err.code,
      status: code,
    });
    let errorMessage;
    if (stage === "chunk" || stage === "embed") {
      const stageCapitalized = stage === "chunk" ? "Chunk" : "Embed";
      errorMessage = `${stageCapitalized} failed${code ? ` (HTTP ${code})` : ""}. Existing vectors unchanged.`;
    } else {
      errorMessage = `Pinecone write failed${code ? ` (HTTP ${code})` : ""}. Namespace may be incomplete; re-run with ?force=true.`;
    }

    const failedFactBank = {
      status: "failed",
      error: errorMessage,
      updatedAt: nowFn(),
    };

    await store.setFactBank(docId, failedFactBank);

    const duration = Date.now() - startTime;
    console.log(
      `[INGEST] docId=${docId} status=failed duration_ms=${duration}`
    );

    return { statusCode: 500, factBank: failedFactBank };
  }
}
