import Fastify from "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";
import fastifyJwt from "@fastify/jwt";
import { closePool } from "./db.js";
import authRoutes from "./routes/auth.js";
import eventsRoutes from "./routes/events.js";
import healthRoutes from "./routes/health.js";
import ingestRoutes from "./routes/ingest.js";
import statsRoutes from "./routes/stats.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  throw new Error("JWT_SECRET is not set. Copy .env.example to .env (or export JWT_SECRET) before starting the service.");
}

const app = Fastify({ logger: true });

await app.register(fastifyJwt, { secret: jwtSecret });

app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    await request.jwtVerify();
  } catch {
    await reply.code(401).send({ error: "unauthorized" });
  }
});

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
  reply.code(statusCode).send({ error: error.message });
});

await app.register(healthRoutes);
await app.register(authRoutes);

// Everything below requires a valid Bearer token.
await app.register(async (scope) => {
  scope.addHook("preHandler", scope.authenticate);
  await scope.register(ingestRoutes);
  await scope.register(eventsRoutes);
  await scope.register(statsRoutes);
});

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
