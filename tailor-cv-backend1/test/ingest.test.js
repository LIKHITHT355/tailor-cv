import test from "node:test";
import assert from "node:assert/strict";
import { runIngest, computeHash, HttpError, FACT_BANK_VERSION } from "../src/services/ingest.js";

function createFakeStore(initialDoc) {
  let doc = initialDoc ? JSON.parse(JSON.stringify(initialDoc)) : null;
  const history = [];

  return {
    getDoc: async (id) => {
      if (!doc || doc._id !== id) return null;
      return JSON.parse(JSON.stringify(doc));
    },
    claim: async (id, now, staleMs) => {
      if (!doc || doc._id !== id) return false;
      const status = doc.factBank?.status;
      const updatedAt = doc.factBank?.updatedAt ? new Date(doc.factBank.updatedAt).getTime() : 0;
      const isProcessing = status === "processing";
      const isStale = updatedAt < now.getTime() - staleMs;

      if (!isProcessing || isStale) {
        doc.factBank = doc.factBank ?? {};
        doc.factBank.status = "processing";
        doc.factBank.updatedAt = now;
        doc.factBank.error = null;
        history.push("processing");
        return true;
      }
      return false;
    },
    setFactBank: async (id, fields) => {
      if (!doc || doc._id !== id) return;
      doc.factBank = { ...(doc.factBank ?? {}), ...fields };
      if (fields.status) {
        history.push(fields.status);
      }
    },
    get currentDoc() {
      return doc;
    },
    history,
  };
}

function createMocks() {
  const calls = {
    embed: 0,
    clear: 0,
    upsert: 0,
  };

  const chunker = {
    chunkResume: async (docId, text) => [
      { id: `${docId}:header:0`, text: "Header info", metadata: { section: "header" } },
      { id: `${docId}:experience:0`, text: "Worked at Acme", metadata: { section: "experience" } },
      { id: `${docId}:education:0`, text: "BSc CompSci", metadata: { section: "education" } },
      { id: `${docId}:skills:0`, text: "JavaScript", metadata: { section: "skills" } },
    ],
    chunkAddon: async (docId, text, section, n) => [
      { id: `${docId}:addon-${section}:${n}`, text, metadata: { section } },
    ],
  };

  const embedTexts = async (texts) => {
    calls.embed += 1;
    return texts.map(() => new Array(1024).fill(0.1));
  };

  const vectorStore = {
    clearNamespace: async () => {
      calls.clear += 1;
    },
    upsertChunks: async () => {
      calls.upsert += 1;
    },
  };

  return { calls, chunker, embedTexts, vectorStore };
}

test("computeHash: stable across CRLF, differs on change", () => {
  const h1 = computeHash("Line 1\r\nLine 2", [{ section: "skills", text: "React" }]);
  const h2 = computeHash("Line 1\nLine 2", [{ section: "skills", text: "React" }]);
  assert.equal(h1, h2);

  const h3 = computeHash("Line 1\nLine 2", [{ section: "skills", text: "React 18" }]);
  assert.notEqual(h1, h3);
});

test("Hash-skip: ready + same hash returns stored without writes or embed", async () => {
  const resumeText = "Experienced developer";
  const addons = [{ section: "skills", text: "Node.js" }];
  const hash = computeHash(resumeText, addons);

  const store = createFakeStore({
    _id: "doc123",
    text: resumeText,
    addons,
    factBank: { status: "ready", hash, totalChunks: 4 },
  });

  const mocks = createMocks();
  const res = await runIngest("doc123", { force: false }, { store, ...mocks });

  assert.equal(res.statusCode, 200);
  assert.equal(res.factBank.status, "ready");
  assert.equal(mocks.calls.embed, 0);
  assert.equal(mocks.calls.clear, 0);
  assert.equal(mocks.calls.upsert, 0);
});

test("Force=true re-runs even if hash matches", async () => {
  const resumeText = "Experienced developer";
  const addons = [{ section: "skills", text: "Node.js" }];
  const hash = computeHash(resumeText, addons);

  const store = createFakeStore({
    _id: "doc123",
    text: resumeText,
    addons,
    factBank: { status: "ready", hash, totalChunks: 4 },
  });

  const mocks = createMocks();
  const res = await runIngest("doc123", { force: true }, { store, ...mocks });

  assert.equal(res.statusCode, 200);
  assert.equal(mocks.calls.embed, 1);
  assert.equal(mocks.calls.clear, 1);
  assert.equal(mocks.calls.upsert, 1);
  assert.deepEqual(store.history, ["processing", "ready"]);
});

test("Failure before clear (embed rejects): clear/upsert never called, status failed, no sentinels leaked", async () => {
  const sentinel = "SECRET_SENTINEL_TOKEN_12345";
  const store = createFakeStore({
    _id: "doc123",
    text: `Resume with ${sentinel}`,
  });

  const mocks = createMocks();
  mocks.embedTexts = async () => {
    const err = new Error(`Embed failed with ${sentinel}`);
    err.status = 502;
    throw err;
  };

  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(" "));

  try {
    const res = await runIngest("doc123", {}, { store, ...mocks });
    assert.equal(res.statusCode, 500);
    assert.equal(res.factBank.status, "failed");
    assert.equal(mocks.calls.clear, 0);
    assert.equal(mocks.calls.upsert, 0);

    const serializedResult = JSON.stringify(res);
    assert.ok(!serializedResult.includes(sentinel), "Sentinel leaked in response");
    assert.ok(!JSON.stringify(store.currentDoc.factBank).includes(sentinel), "Sentinel leaked in store factBank");
    assert.ok(!logs.some((l) => l.includes(sentinel)), "Sentinel leaked in console logs");
  } finally {
    console.log = originalLog;
  }
});

test("Upsert rejects -> failed, error contains 'incomplete'", async () => {
  const store = createFakeStore({
    _id: "doc123",
    text: "Valid resume text",
  });

  const mocks = createMocks();
  mocks.vectorStore.upsertChunks = async () => {
    const err = new Error("Pinecone network timeout");
    err.status = 504;
    throw err;
  };

  const res = await runIngest("doc123", {}, { store, ...mocks });
  assert.equal(res.statusCode, 500);
  assert.equal(res.factBank.status, "failed");
  assert.ok(res.factBank.error.includes("incomplete"));
  assert.deepEqual(store.history, ["processing", "failed"]);
});

test("409 when processing updated 1 min ago; proceeds when 6 min ago", async () => {
  const now = new Date();
  const store = createFakeStore({
    _id: "doc123",
    text: "Valid resume text",
    factBank: {
      status: "processing",
      updatedAt: new Date(now.getTime() - 1 * 60 * 1000),
    },
  });

  const mocks = createMocks();
  await assert.rejects(
    () => runIngest("doc123", {}, { store, ...mocks, now: () => now }),
    (err) => err instanceof HttpError && err.status === 409
  );
  assert.equal(mocks.calls.embed, 0);

  // Advance clock to 6 minutes later -> stale lock can be reclaimed
  const later = new Date(now.getTime() + 6 * 60 * 1000);
  const res = await runIngest("doc123", {}, { store, ...mocks, now: () => later });
  assert.equal(res.statusCode, 200);
  assert.equal(res.factBank.status, "ready");
});

test("400 on empty resume with no claim made; 404 on missing doc", async () => {
  const storeMissing = createFakeStore(null);
  const mocks = createMocks();

  await assert.rejects(
    () => runIngest("doc999", {}, { store: storeMissing, ...mocks }),
    (err) => err instanceof HttpError && err.status === 404
  );

  const storeEmpty = createFakeStore({
    _id: "doc123",
    text: "   ",
  });

  await assert.rejects(
    () => runIngest("doc123", {}, { store: storeEmpty, ...mocks }),
    (err) => err instanceof HttpError && err.status === 400
  );
  assert.equal(storeEmpty.history.length, 0, "No claim should have been made on empty resume");
});
