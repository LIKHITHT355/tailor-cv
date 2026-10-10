import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const CONTENT_SECTIONS = new Set([
  "education",
  "experience",
  "certification",
  "skills",
  "project",
]);

const SECTION_ALIASES = new Map([
  ["education", "education"],
  ["experience", "experience"],
  ["work experience", "experience"],
  ["internships", "experience"],
  ["certification", "certification"],
  ["certifications", "certification"],
  ["achievements", "certification"],
  ["skills", "skills"],
  ["technical skills", "skills"],
  ["project", "project"],
  ["projects", "project"],
]);

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 80,
  separators: ["\n\n", "\n", ". ", " ", ""],
});

function assertNonEmptyString(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

function normalizeText(value) {
  return value.replace(/\r\n?/g, "\n").trim();
}

function headingFor(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 40) return undefined;
  const candidate = trimmed.replace(/:\s*$/, "").trim().toLowerCase();
  return SECTION_ALIASES.get(candidate);
}

function isUnknownHeading(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 40 || headingFor(trimmed)) return false;
  return /:\s*$/.test(trimmed) || (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed));
}

function splitSections(text) {
  const sections = new Map([["header", []]]);
  let current = "header";

  for (const line of normalizeText(text).split("\n")) {
    const heading = headingFor(line);
    if (heading) {
      current = heading;
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    if (isUnknownHeading(line)) {
      current = undefined;
      continue;
    }
    if (current) sections.get(current).push(line);
  }

  return sections;
}

function entryTexts(section, text) {
  const clean = normalizeText(text);
  if (!clean) return [];
  if (section === "header" || section === "skills") return [clean];

  const blankSplit = clean.split(/\n\s*\n+/).map((entry) => entry.trim()).filter(Boolean);
  if (blankSplit.length > 1) return blankSplit;

  const lines = clean.split("\n");
  const entries = [];
  let entry = [];
  let previousWasBullet = false;
  for (const line of lines) {
    const isBullet = /^\s*[-\u2022*\u2013\u25cf]\s+/.test(line);
    if (entry.length > 0 && previousWasBullet && line.trim() && !isBullet) {
      entries.push(entry.join("\n").trim());
      entry = [];
    }
    entry.push(line);
    previousWasBullet = isBullet;
  }
  if (entry.length) entries.push(entry.join("\n").trim());
  return entries.filter(Boolean);
}

async function splitOversized(text) {
  if (text.length <= 1000) return [text];
  const [firstLine, ...rest] = text.split("\n");
  const body = rest.join("\n").trim() || firstLine;
  const parts = await splitter.splitText(body);
  return parts.map((part) => `${firstLine}\n${part}`.trim());
}

async function chunksForEntry({ docId, section, entryIndex, text, source, idBase }) {
  const parts = await splitOversized(text);
  return parts.filter(Boolean).map((partText, part) => ({
    id: parts.length === 1 ? idBase : `${idBase}:${part}`,
    text: partText,
    metadata: { docId, section, entryIndex, part, source },
  }));
}

export async function chunkResume(docId, text) {
  assertNonEmptyString(docId, "docId");
  assertNonEmptyString(text, "text");

  const chunks = [];
  for (const [section, lines] of splitSections(text)) {
    const sectionText = lines.join("\n");
    const entries = entryTexts(section, sectionText);
    for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
      chunks.push(...await chunksForEntry({
        docId,
        section,
        entryIndex,
        text: entries[entryIndex],
        source: "resume",
        idBase: `${docId}:${section}:${entryIndex}`,
      }));
    }
  }
  return chunks;
}

export async function chunkAddon(docId, text, section, n) {
  assertNonEmptyString(docId, "docId");
  assertNonEmptyString(text, "text");
  if (!CONTENT_SECTIONS.has(section)) {
    throw new RangeError("section must be education, experience, certification, skills, or project");
  }
  if (!Number.isInteger(n) || n < 0) throw new RangeError("n must be a non-negative integer");

  return chunksForEntry({
    docId,
    section,
    entryIndex: n,
    text: normalizeText(text),
    source: "user_addon",
    idBase: `${docId}:addon-${section}:${n}`,
  });
}
