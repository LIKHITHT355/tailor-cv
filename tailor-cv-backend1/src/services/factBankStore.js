import { Document } from "../models/Document.js";

export async function getDoc(docId) {
  return Document.findById(docId).lean().exec();
}

export async function claim(docId, now, staleMs) {
  const staleThreshold = new Date(now.getTime() - staleMs);
  const result = await Document.updateOne(
    {
      _id: docId,
      $or: [
        { "factBank.status": { $ne: "processing" } },
        { "factBank.updatedAt": { $lt: staleThreshold } },
      ],
    },
    {
      $set: {
        "factBank.status": "processing",
        "factBank.updatedAt": now,
        "factBank.error": null,
      },
    }
  ).exec();

  return (result.matchedCount ?? result.nModified ?? 0) > 0;
}

export async function setFactBank(docId, fields) {
  const $set = {};
  for (const [key, value] of Object.entries(fields)) {
    $set[`factBank.${key}`] = value;
  }
  return Document.updateOne({ _id: docId }, { $set }).exec();
}
