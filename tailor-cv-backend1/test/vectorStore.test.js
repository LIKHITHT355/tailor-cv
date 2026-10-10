import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeMetadata,
  namespaceNotFound,
  extractNumericStatus,
} from "../src/services/vectorStore.js";

test("sanitizeMetadata: drops null and undefined, keeps valid keys, converts non-primitives", () => {
  const raw = {
    docId: "doc123",
    section: "skills",
    entryIndex: 0,
    part: 1,
    source: "resume",
    badNull: null,
    badUndefined: undefined,
    numberVal: 42,
    boolVal: true,
    arrayStrings: ["a", "b"],
    objVal: { nested: "val" },
  };

  const sanitized = sanitizeMetadata(raw, "sample text");

  assert.equal(sanitized.docId, "doc123");
  assert.equal(sanitized.section, "skills");
  assert.equal(sanitized.entryIndex, 0);
  assert.equal(sanitized.part, 1);
  assert.equal(sanitized.source, "resume");
  assert.equal(sanitized.text, "sample text");
  assert.equal(sanitized.numberVal, 42);
  assert.equal(sanitized.boolVal, true);
  assert.deepEqual(sanitized.arrayStrings, ["a", "b"]);
  assert.equal(sanitized.objVal, "[object Object]");

  // Must not have null or undefined keys
  assert.equal("badNull" in sanitized, false);
  assert.equal("badUndefined" in sanitized, false);
  for (const [key, value] of Object.entries(sanitized)) {
    assert.notEqual(value, null, `Key ${key} has null value`);
    assert.notEqual(value, undefined, `Key ${key} has undefined value`);
  }
});

test("namespaceNotFound: correctly identifies nonexistent namespace errors", () => {
  const notFoundError = new Error("A call to https://example.com returned HTTP status 404.");
  notFoundError.name = "PineconeNotFoundError";

  assert.equal(namespaceNotFound(notFoundError), true);
  assert.equal(namespaceNotFound({ name: "PineconeNotFoundError" }), true);
  assert.equal(namespaceNotFound({ status: 404 }), true);
  assert.equal(namespaceNotFound({ statusCode: 404 }), true);
  assert.equal(namespaceNotFound(new Error("Namespace doc123 not found")), true);

  // Other errors should not match
  assert.equal(namespaceNotFound(new Error("Unauthorized")), false);
  assert.equal(namespaceNotFound({ name: "PineconeAuthorizationError", status: 401 }), false);
  assert.equal(namespaceNotFound(null), false);
});

test("extractNumericStatus: retrieves numeric status from error objects and messages", () => {
  assert.equal(extractNumericStatus({ status: 404 }), 404);
  assert.equal(extractNumericStatus({ statusCode: 500 }), 500);
  assert.equal(extractNumericStatus({ cause: { status: 401 } }), 401);
  assert.equal(extractNumericStatus({ response: { status: 403 } }), 403);
  assert.equal(extractNumericStatus({ name: "PineconeNotFoundError" }), 404);
  assert.equal(extractNumericStatus({ name: "PineconeAuthorizationError" }), 401);
  assert.equal(extractNumericStatus(new Error("HTTP status 429")), 429);
  assert.equal(extractNumericStatus(new Error("Generic error")), undefined);
});
