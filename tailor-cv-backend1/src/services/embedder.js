import { Mistral } from "@mistralai/mistralai";
import { env } from "../config/env.js";

export const MISTRAL_EMBED_MODEL = "mistral-embed";
const BATCH_SIZE = 32;
const MAX_ATTEMPTS = 5;

let client;

function getClient() {
  client ??= new Mistral({ apiKey: env.mistralApiKey });
  return client;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function statusOf(error) {
  return error?.statusCode ?? error?.status ?? error?.response?.status;
}

function retryAfterMilliseconds(error) {
  const headers = error?.response?.headers ?? error?.headers;
  const value = headers?.get?.("retry-after") ?? headers?.["retry-after"];
  const seconds = Number.parseFloat(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const retryAt = Date.parse(value);
  return Number.isFinite(retryAt) ? Math.max(0, retryAt - Date.now()) : undefined;
}

async function embedBatch(texts) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await getClient().embeddings.create({
        model: MISTRAL_EMBED_MODEL,
        inputs: texts,
      });
      const vectors = response.data?.map((item) => item.embedding);
      if (!vectors || vectors.length !== texts.length || vectors.some((vector) => !Array.isArray(vector))) {
        throw new Error("Mistral returned an invalid embedding response");
      }
      return vectors;
    } catch (error) {
      const status = statusOf(error);
      const retryable = status === 429 || (Number.isInteger(status) && status >= 500 && status <= 599);
      if (!retryable || attempt === MAX_ATTEMPTS) {
        throw new Error(`Mistral embedding request failed${status ? ` (HTTP ${status})` : ""}`, { cause: error });
      }
      await delay(retryAfterMilliseconds(error) ?? 300 * (2 ** (attempt - 1)));
    }
  }
}

export async function embedTexts(texts) {
  if (!Array.isArray(texts) || texts.some((text) => typeof text !== "string")) {
    throw new TypeError("texts must be an array of strings");
  }
  const vectors = [];
  for (let start = 0; start < texts.length; start += BATCH_SIZE) {
    if (start > 0) await delay(300);
    vectors.push(...await embedBatch(texts.slice(start, start + BATCH_SIZE)));
  }
  return vectors;
}
