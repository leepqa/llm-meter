import type { FastifyPluginAsync } from "fastify";
import { query } from "../db.js";

const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async (request, reply) => {
    try {
      await query("SELECT 1");
    } catch (error) {
      request.log.error(error);
      return reply.code(503).send({ status: "error" });
    }
    return { status: "ok", db: "up" };
  });
};

export default healthRoutes;
