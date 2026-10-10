import mongoose from "mongoose";

import { env } from "../config/env.js";

const documentSchema = new mongoose.Schema({}, {
  collection: env.mongoCollection,
  strict: false,
  versionKey: false,
});

export const Document = mongoose.models.Document
  ?? mongoose.model("Document", documentSchema, env.mongoCollection);
