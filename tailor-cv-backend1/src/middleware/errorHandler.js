import { env } from "../config/env.js";

export function errorHandler(error, req, res, _next) {
  const status = Number.isInteger(error.status) ? error.status : 500;

  if (status >= 500) {
    const docId = req.params?.docId || req.params?.id || "none";
    console.error(
      `[ERROR 5xx] method=${req.method} route=${req.path} docId=${docId} err.name=${error.name || "Error"} err.code=${error.code ?? "none"}`
    );
  }

  const message =
    status >= 500 && env.nodeEnv === "production"
      ? "Internal server error"
      : error.message || "Internal server error";

  res.status(status).json({ error: message });
}
