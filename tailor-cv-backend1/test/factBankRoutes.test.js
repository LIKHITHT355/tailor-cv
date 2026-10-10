import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createFactBankRouter } from "../src/routes/factBank.js";
import { errorHandler } from "../src/middleware/errorHandler.js";

function setupApp(deps = {}) {
  const app = express();
  app.use(express.json());
  app.use("/api/fact-bank", createFactBankRouter({ enableDev: true, deps }));
  app.use(errorHandler);
  return app;
}

test("factBankRoutes: invalid ObjectId returns 400", async () => {
  const app = setupApp();
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api/fact-bank`;

  try {
    const resPost = await fetch(`${baseUrl}/invalid-id`, { method: "POST" });
    assert.equal(resPost.status, 400);

    const resGet = await fetch(`${baseUrl}/invalid-id/status`);
    assert.equal(resGet.status, 400);
  } finally {
    server.close();
  }
});

test("factBankRoutes: GET /:docId/status returns 404 if missing, factBank or {status:'none'}", async () => {
  const validId = "507f1f77bcf86cd799439011";
  const validIdNone = "507f1f77bcf86cd799439022";
  const validIdReady = "507f1f77bcf86cd799439033";

  const fakeStore = {
    getDoc: async (id) => {
      if (id === validIdNone) return { _id: validIdNone, text: "Some resume" };
      if (id === validIdReady) {
        return {
          _id: validIdReady,
          text: "Some resume",
          factBank: { status: "ready", totalChunks: 3 },
        };
      }
      return null;
    },
  };

  const app = setupApp({ store: fakeStore });
  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api/fact-bank`;

  try {
    // Missing doc -> 404
    const res404 = await fetch(`${baseUrl}/${validId}/status`);
    assert.equal(res404.status, 404);

    // Doc with no factBank -> { status: 'none' }
    const resNone = await fetch(`${baseUrl}/${validIdNone}/status`);
    assert.equal(resNone.status, 200);
    const jsonNone = await resNone.json();
    assert.deepEqual(jsonNone, { status: "none" });

    // Doc with ready factBank -> returns factBank
    const resReady = await fetch(`${baseUrl}/${validIdReady}/status`);
    assert.equal(resReady.status, 200);
    const jsonReady = await resReady.json();
    assert.equal(jsonReady.status, "ready");
    assert.equal(jsonReady.totalChunks, 3);
  } finally {
    server.close();
  }
});

test("factBankRoutes: POST /:docId runs ingest and returns factBank", async () => {
  const validId = "507f1f77bcf86cd799439011";
  const fakeStore = {
    getDoc: async (id) => ({
      _id: id,
      text: "Developer resume text",
      factBank: { status: "ready", hash: "dummy" },
    }),
    claim: async () => true,
    setFactBank: async () => {},
  };

  const app = setupApp({
    store: fakeStore,
    chunker: {
      chunkResume: async () => [
        { id: "1", text: "Resume part", metadata: { section: "skills" } },
      ],
      chunkAddon: async () => [],
    },
    embedTexts: async () => [new Array(1024).fill(0)],
    vectorStore: {
      clearNamespace: async () => {},
      upsertChunks: async () => {},
    },
  });

  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api/fact-bank`;

  try {
    const res = await fetch(`${baseUrl}/${validId}?force=true`, { method: "POST" });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "ready");
  } finally {
    server.close();
  }
});
