import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import healthRouter from "./routes/health.js";
import apiRouter from "./routes/index.js";

const app = express();

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    const allowed = [
      env.frontendOrigin,
      "http://localhost:8081",
      "http://localhost:8080",
      "http://127.0.0.1:8081",
      "http://127.0.0.1:8080",
    ];
    if (!origin || allowed.includes(origin) || env.frontendOrigin === "*") {
      return callback(null, true);
    }

    const error = new Error("Origin is not allowed by CORS");
    error.status = 403;
    return callback(error);
  },
}));
app.use(express.json());
app.use(morgan("tiny"));

app.use("/health", healthRouter);
app.use("/api", apiRouter);

app.use((_req, _res, next) => {
  const error = new Error("Route not found");
  error.status = 404;
  next(error);
});

app.use(errorHandler);

export default app;
