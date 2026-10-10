import app from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/db.js";
import { env } from "./config/env.js";

let server;

async function startServer() {
  try {
    await connectDatabase();
    server = app.listen(env.port, () => {
      console.log(`Node API listening on port ${env.port}`);
    });
  } catch (err) {
    console.error("Database connection failed. Server cannot start.");
    process.exit(1);
  }
}

startServer();

let isShuttingDown = false;

async function shutdown() {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  if (server) {
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  } else {
    await disconnectDatabase();
    process.exit(0);
  }
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
