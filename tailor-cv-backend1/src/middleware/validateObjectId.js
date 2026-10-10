import mongoose from "mongoose";

export function validateObjectId(req, res, next) {
  const id = req.params.docId ?? req.params.id;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ error: "Invalid document id" });
  }

  return next();
}
