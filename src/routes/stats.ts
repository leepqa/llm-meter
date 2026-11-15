import type { FastifyPluginAsync } from "fastify";
import { query } from "../db.js";

const DEFAULT_RANGE_MS = 7 * 24 * 60 * 60 * 1000;

const statsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/stats", async (request, reply) => {
    const raw = request.query as Record<string, string | undefined>;
    if (raw.group !== undefined && raw.group !== "day" && raw.group !== "model") {
      return reply.code(400).send({ error: `invalid group: ${raw.group}` });
    }

    const group = raw.group === "model" ? "model" : "day";

    const to = raw.to ? new Date(raw.to) : new Date();
    if (Number.isNaN(to.getTime())) {
      return reply.code(400).send({ error: `invalid to: ${raw.to}` });
    }

    const from = raw.from ? new Date(raw.from) : new Date(to.getTime() - DEFAULT_RANGE_MS);
    if (Number.isNaN(from.getTime())) {
      return reply.code(400).send({ error: `invalid from: ${raw.from}` });
    }

    // Bucket expression is chosen from a fixed whitelist, never from user input directly.
    const bucket = group === "day" ? "date_trunc('day', e.ts)::date" : "m.name";

    const result = await query(
      `SELECT ${bucket} AS bucket,
              count(*)::int AS events,
              coalesce(sum(e.tokens_in), 0)::float8 AS tokens_in,
              coalesce(sum(e.tokens_out), 0)::float8 AS tokens_out,
              coalesce(sum(e.cached_tokens), 0)::float8 AS cached_tokens,
              coalesce(sum(e.cost_rub), 0)::float8 AS cost_rub,
              coalesce(avg(e.latency_ms), 0)::float8 AS avg_latency_ms,
              (count(*) FILTER (WHERE e.status = 'error'))::float8 / count(*) AS error_rate
       FROM llm_events e
       JOIN models m ON m.id = e.model_id
       WHERE e.ts >= $1 AND e.ts < $2
       GROUP BY 1
       ORDER BY 1`,
      [from.toISOString(), to.toISOString()],
    );

    return { from: from.toISOString(), to: to.toISOString(), group, rows: result.rows };
  });
};

export default statsRoutes;
