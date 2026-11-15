import type { FastifyPluginAsync } from "fastify";
import { query } from "../db.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

function intParam(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}

const eventsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/events", async (request, reply) => {
    const raw = request.query as Record<string, string | undefined>;
    const params: unknown[] = [];
    const where: string[] = [];

    for (const [field, operator] of [
      ["from", ">="],
      ["to", "<"],
    ] as const) {
      const value = raw[field];
      if (!value) {
        continue;
      }
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return reply.code(400).send({ error: `invalid ${field}: ${value}` });
      }
      params.push(date.toISOString());
      where.push(`e.ts ${operator} $${params.length}`);
    }

    if (raw.model) {
      params.push(raw.model);
      where.push(`m.name = $${params.length}`);
    }
    if (raw.status) {
      params.push(raw.status);
      where.push(`e.status = $${params.length}`);
    }

    const limit = intParam(raw.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
    const offset = intParam(raw.offset, 0, 0, Number.MAX_SAFE_INTEGER);
    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    const totalResult = await query<{ total: number }>(
      `SELECT count(*)::int AS total
       FROM llm_events e
       JOIN models m ON m.id = e.model_id
       ${whereSql}`,
      params,
    );

    const items = await query(
      `SELECT e.id,
              e.event_id,
              e.ts,
              m.name AS model,
              e.tokens_in,
              e.tokens_out,
              e.cached_tokens,
              e.latency_ms,
              e.status,
              e.cost_rub::float8 AS cost_rub,
              e.task_id,
              e.meta
       FROM llm_events e
       JOIN models m ON m.id = e.model_id
       ${whereSql}
       ORDER BY e.ts DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );

    return {
      items: items.rows,
      total: totalResult.rows[0]?.total ?? 0,
      limit,
      offset,
    };
  });
};

export default eventsRoutes;
