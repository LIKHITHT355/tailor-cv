import { Router } from "express";

import { Document } from "../models/Document.js";
import { validateObjectId } from "../middleware/validateObjectId.js";

const router = Router();

router.get("/:id", validateObjectId, async (req, res, next) => {
  try {
    const document = await Document.findById(req.params.id).lean().exec();

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    return res.status(200).json(document);
  } catch (error) {
    return next(error);
  }
});

export default router;
