import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";

// 1. Candidate paths for tailor-cv-backend1 .env
const nodeEnvCandidates = [
  path.resolve(import.meta.dirname, "../../.env"),
  path.resolve(import.meta.dirname, "../../../.env"),
  path.resolve(process.cwd(), ".env"),
];
for (const p of nodeEnvCandidates) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

// 2. Candidate paths for flask-api .env (for matching MongoDB connection if needed)
const flaskEnvCandidates = [
  path.resolve(import.meta.dirname, "../../../tailor-cv-backend/flask-api/.env"),
  path.resolve(import.meta.dirname, "../../../../tailor-cv-backend/flask-api/.env"),
  path.resolve(process.cwd(), "../tailor-cv-backend/flask-api/.env"),
];
for (const p of flaskEnvCandidates) {
  if (fs.existsSync(p)) {
    const flaskConfig = dotenv.parse(fs.readFileSync(p));
    if (flaskConfig.MONGO_URI) {
      process.env.MONGO_URI = flaskConfig.MONGO_URI;
    }
    if (flaskConfig.MONGO_DB) {
      process.env.MONGO_DB = flaskConfig.MONGO_DB;
    }
    break;
  }
}

// 3. Fallback
dotenv.config();

const defaults = {
  PORT: "5001",
  MONGO_URI: "mongodb://127.0.0.1:27017",
  MONGO_COLLECTION: "documents",
  FRONTEND_ORIGIN: "*",
  MISTRAL_API_KEY: "dummy-mistral-key",
  PINECONE_API_KEY: "dummy-pinecone-key",
  PINECONE_INDEX: "dummy-index",
};

for (const [key, value] of Object.entries(defaults)) {
  if (!process.env[key] || !process.env[key].trim()) {
    process.env[key] = value;
  }
}

const mongoDbName =
  process.env.MONGO_DB || process.env.MONGO_DB_NAME || "doc_extract";
const port = Number.parseInt(process.env.PORT, 10) || 5001;

export const env = Object.freeze({
  port,
  mongoUri: process.env.MONGO_URI,
  mongoDbName,
  mongoCollection: process.env.MONGO_COLLECTION || "documents",
  frontendOrigin: process.env.FRONTEND_ORIGIN,
  mistralApiKey: process.env.MISTRAL_API_KEY,
  pineconeApiKey: process.env.PINECONE_API_KEY,
  pineconeIndex: process.env.PINECONE_INDEX,
  nodeEnv: process.env.NODE_ENV ?? "development",
});
