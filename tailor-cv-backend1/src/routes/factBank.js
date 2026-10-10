import { Router } from "express";
import { validateObjectId } from "../middleware/validateObjectId.js";
import { getDoc } from "../services/factBankStore.js";
import { runIngest, parseSearchQuery, SIX_SECTIONS } from "../services/ingest.js";
import { fetchSection, searchSections } from "../services/vectorStore.js";
import { embedTexts } from "../services/embedder.js";

export function createFactBankRouter({ enableDev = false, deps = {} } = {}) {
  const router = Router();

  // POST /:docId (?force=true) -> res.status(statusCode).json(factBank)
  router.post("/:docId", validateObjectId, async (req, res, next) => {
    try {
      const { docId } = req.params;
      const force = req.query.force === "true";
      const result = await runIngest(docId, { force }, deps);
      return res.status(result.statusCode).json(result.factBank);
    } catch (err) {
      return next(err);
    }
  });

  // GET /:docId/status -> 404 if doc missing; else 200 factBank, or {status:'none'}.
  router.get("/:docId/status", validateObjectId, async (req, res, next) => {
    try {
      const { docId } = req.params;
      const store = deps.store ?? { getDoc };
      const doc = await store.getDoc(docId);
      if (!doc) {
        return res.status(404).json({ error: "Document not found" });
      }
      const factBank = doc.factBank || { status: "none" };
      return res.status(200).json(factBank);
    } catch (err) {
      return next(err);
    }
  });

  if (enableDev) {
    // GET /:docId/section/:section
    router.get("/:docId/section/:section", validateObjectId, async (req, res, next) => {
      try {
        const { docId, section } = req.params;
        if (!SIX_SECTIONS.includes(section)) {
          return res.status(400).json({
            error: `Invalid section '${section}'. Allowed: ${SIX_SECTIONS.join(", ")}`,
          });
        }
        const vStore = deps.vectorStore ?? { fetchSection };
        const chunks = await vStore.fetchSection(docId, section);
        return res.status(200).json({ section, count: chunks.length, chunks });
      } catch (err) {
        return next(err);
      }
    });

    // GET /:docId/search?q=&sections=&topK=
    router.get("/:docId/search", validateObjectId, async (req, res, next) => {
      try {
        const { docId } = req.params;
        const parsed = parseSearchQuery(req.query);
        const embed = deps.embedTexts ?? embedTexts;
        const vStore = deps.vectorStore ?? { searchSections };
        const [vector] = await embed([parsed.query]);
        const matches = await vStore.searchSections(
          docId,
          vector,
          parsed.sections,
          parsed.topK
        );
        return res.status(200).json({ matches });
      } catch (err) {
        return next(err);
      }
    });
  }

  return router;
}

export default createFactBankRouter({
  enableDev: process.env.NODE_ENV !== "production",
});
