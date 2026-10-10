import test from "node:test";
import assert from "node:assert/strict";
import { parseSearchQuery, HttpError } from "../src/services/ingest.js";

test("parseSearchQuery: default values", () => {
  const result = parseSearchQuery({ q: "react developer" });
  assert.equal(result.q, "react developer");
  assert.deepEqual(result.sections, ["skills", "project"]);
  assert.equal(result.topK, 5);
});

test("parseSearchQuery: trims q and accepts custom valid values", () => {
  const result = parseSearchQuery({
    q: "   cloud engineer   ",
    sections: "education,experience",
    topK: "3",
  });
  assert.equal(result.q, "cloud engineer");
  assert.deepEqual(result.sections, ["education", "experience"]);
  assert.equal(result.topK, 3);
});

test("parseSearchQuery: dedupes sections and ignores extra whitespace", () => {
  const result = parseSearchQuery({
    q: "python",
    sections: "skills, skills, project,skills ",
  });
  assert.deepEqual(result.sections, ["skills", "project"]);
});

test("parseSearchQuery: boundary q empty throws 400", () => {
  assert.throws(
    () => parseSearchQuery({ q: "" }),
    (err) => err instanceof HttpError && err.status === 400
  );
  assert.throws(
    () => parseSearchQuery({ q: "   " }),
    (err) => err instanceof HttpError && err.status === 400
  );
  assert.throws(
    () => parseSearchQuery({}),
    (err) => err instanceof HttpError && err.status === 400
  );
});

test("parseSearchQuery: boundary q 201 characters throws 400", () => {
  const tooLong = "a".repeat(201);
  assert.throws(
    () => parseSearchQuery({ q: tooLong }),
    (err) => err instanceof HttpError && err.status === 400
  );

  const exact200 = "a".repeat(200);
  const result = parseSearchQuery({ q: exact200 });
  assert.equal(result.q, exact200);
});

test("parseSearchQuery: bad section throws 400", () => {
  assert.throws(
    () => parseSearchQuery({ q: "valid", sections: "skills,unknown" }),
    (err) => err instanceof HttpError && err.status === 400 && err.message.includes("unknown")
  );
});

test("parseSearchQuery: topK 0, 11, abc throws 400", () => {
  for (const badTopK of [0, 11, "abc", -1, "0", "11", "3.5"]) {
    assert.throws(
      () => parseSearchQuery({ q: "valid", topK: badTopK }),
      (err) => err instanceof HttpError && err.status === 400
    );
  }
});
