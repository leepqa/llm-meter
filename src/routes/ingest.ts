import type { FastifyPluginAsync } from "fastify";
import { withTransaction } from "../db.js";

type ModelRow = {
  id: number;
  name: string;
  price_in_per_m: string;
  price_out_per_m: string;
  price_cached_per_m: string;
};

type IngestEvent = {
  event_id: string;
  ts: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  cached_tokens: number;
  latency_ms: number;
  status: string;
  task_id: string | null;
};

const REQUIRED_STRINGS = ["event_id", "ts", "model", "status"] as const;
const COUNTERS = ["tokens_in", "tokens_out", "cached_tokens", "latency_ms"] as const;

function parseEvents(body: unknown): { events: IngestEvent[] } | { error: string } {
  const items = Array.isArray(body) ? body : [body];
  const events: IngestEvent[] = [];

  for (const [index, item] of items.entries()) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return { error: `event[${index}] must be an object` };
    }
    const raw = item as Record<string, unknown>;

    for (const field of REQUIRED_STRINGS) {
      const value = raw[field];
      if (typeof value !== "string" || value.trim() === "") {
        return { error: `event[${index}].${field} must be a non-empty string` };
      }
    }

    const ts = new Date(raw.ts as string);
    if (Number.isNaN(ts.getTime())) {
      return { error: `event[${index}].ts must be an ISO timestamp` };
    }

    const event: IngestEvent = {
      event_id: raw.event_id as string,
      ts: ts.toISOString(),
      model: raw.model as string,
      tokens_in: 0,
      tokens_out: 0,
      cached_tokens: 0,
      latency_ms: 0,
      status: raw.status as string,
      task_id: typeof raw.task_id === "string" ? raw.task_id : null,
    };

    for (const field of COUNTERS) {
      const value = raw[field] ?? 0;
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        return { error: `event[${index}].${field} must be a non-negative number` };
      }
      event[field] = Math.round(value);
    }

    events.push(event);
  }

  return { events };
}

const ingestRoutes: FastifyPluginAsync = async (app) => {
  app.post("/ingest", async (request, reply) => {
    const parsed = parseEvents(request.body);
    if ("error" in parsed) {
      return reply.code(400).send({ error: parsed.error });
    }

    const events = parsed.events;
    if (events.length === 0) {
      return { received: 0, inserted: 0, duplicates: 0 };
    }

    const result = await withTransaction(async (client) => {
      const names = [...new Set(events.map((event) => event.model))];
      const models = await client.query<ModelRow>(
        `SELECT id, name, price_in_per_m, price_out_per_m, price_cached_per_m
         FROM models
         WHERE name = ANY($1::text[])`,
        [names],
      );
      const byName = new Map(models.rows.map((model) => [model.name, model]));

      const unknown = names.filter((name) => !byName.has(name));
      if (unknown.length > 0) {
        return { unknown, inserted: 0 };
      }

      let inserted = 0;
      for (const event of events) {
        const model = byName.get(event.model)!;
        const res = await client.query(
          `INSERT INTO llm_events
             (event_id, ts, model_id, tokens_in, tokens_out, cached_tokens, latency_ms, status, cost_rub, task_id)
           VALUES
             ($1, $2, $3, $4::int, $5::int, $6::int, $7::int, $8,
              $4::int::numeric / 1000000 * $9::numeric
                + $5::int::numeric / 1000000 * $10::numeric
                + $6::int::numeric / 1000000 * $11::numeric,
              $12)
           ON CONFLICT (event_id) DO NOTHING`,
          [
            event.event_id,
            event.ts,
            model.id,
            event.tokens_in,
            event.tokens_out,
            event.cached_tokens,
            event.latency_ms,
            event.status,
            model.price_in_per_m,
            model.price_out_per_m,
            model.price_cached_per_m,
            event.task_id,
          ],
        );
        inserted += res.rowCount ?? 0;
      }

      return { unknown: [], inserted };
    });

    if (result.unknown.length > 0) {
      return reply.code(400).send({ error: `unknown models: ${result.unknown.join(", ")}` });
    }

    return { received: events.length, inserted: result.inserted, duplicates: events.length - result.inserted };
  });
};

export default ingestRoutes;
