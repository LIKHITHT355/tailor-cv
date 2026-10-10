import assert from "node:assert/strict";
import test from "node:test";
import { chunkResume } from "../src/services/chunker.js";

const longDetail = "Reliable delivery and measurable impact. ".repeat(40);
const resume = `Avery Example\navery@example.test\n\nEDUCATION\nNorthstar University\nBSc Computer Science\n\nEXPERIENCE\nPlatform Engineer | Atlas Co | 2023-present\n- Built reliable services\n- Improved release safety\nResearch Intern | Nova Lab | 2022\n- Analysed system behavior\n\nPROJECTS:\nSignal Mapper | https://example.test\n${longDetail}\n\nTECHNICAL SKILLS\nJavaScript, Node.js, MongoDB\n\nCERTIFICATIONS\nCloud Practitioner\nIssued 2024\n\nHOBBIES:\nThis content must not be indexed.`;

test("chunkResume produces section-aware deterministic chunks", async () => {
  const chunks = await chunkResume("doc-42", resume);
  const sections = new Set(chunks.map((chunk) => chunk.metadata.section));

  assert.deepEqual(sections, new Set(["header", "education", "experience", "project", "skills", "certification"]));
  assert.ok(chunks.every((chunk) => /^doc-42:(?:header|education|experience|project|skills|certification):\d+(?::\d+)?$/.test(chunk.id)));
  assert.ok(chunks.every((chunk) => chunk.text.trim().length > 0));
  assert.ok(chunks.some((chunk) => chunk.metadata.section === "header" && chunk.text.trim()));
  assert.ok(chunks.every((chunk) => !chunk.text.includes("must not be indexed")));

  const projectParts = chunks.filter((chunk) => chunk.metadata.section === "project");
  assert.ok(projectParts.length > 1);
  assert.ok(projectParts.every((chunk) => chunk.text.startsWith("Signal Mapper | https://example.test")));
});
