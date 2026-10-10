/*
  getSkills.js – fetch the "skills" section from a document's fact‑bank and log it.
  Usage:  node src/scripts/getSkills.js <docId>
*/

import { fetchSection } from "../services/vectorStore.js";

async function main() {
  const [docId] = process.argv.slice(2);
  if (!docId || typeof docId !== "string" || !docId.trim()) {
    console.error("Error: a non‑empty document ID must be provided as the first argument");
    process.exit(1);
  }
  try {
    const skills = await fetchSection(docId, "skills");
    console.log(JSON.stringify({ docId, skills }, null, 2));
  } catch (err) {
    console.error("Failed to fetch skills:", err.message ?? err);
    process.exit(1);
  }
}

main();
