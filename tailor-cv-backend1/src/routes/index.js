import { Router } from "express";

import documentsRouter from "./documents.js";
import { createFactBankRouter } from "./factBank.js";

const router = Router();

router.use("/documents", documentsRouter);
router.use(
  "/fact-bank",
  createFactBankRouter({ enableDev: process.env.NODE_ENV !== "production" })
);

export default router;
