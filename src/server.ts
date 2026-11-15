import { buildApp } from "./app.js";
import { closePool } from "./db.js";

const app = await buildApp();
const port = Number(process.env.PORT ?? 3000);

await app.listen({ host: "0.0.0.0", port });

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  app.log.info(`received ${signal}, shutting down`);
  try {
    await app.close();
    await closePool();
    process.exit(0);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
