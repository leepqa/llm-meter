import { query } from "../src/db.js";

/** Same four models as scripts/seed.ts, so /stats?group=model is deterministic. */
export const MODELS = [
  { name: "gpt-4o-mini", price_in_per_m: 15, price_out_per_m: 60, price_cached_per_m: 7.5 },
  { name: "gpt-4o", price_in_per_m: 250, price_out_per_m: 1000, price_cached_per_m: 125 },
  { name: "claude-3-5-sonnet", price_in_per_m: 300, price_out_per_m: 1500, price_cached_per_m: 150 },
  { name: "llama-3-1-70b", price_in_per_m: 10, price_out_per_m: 40, price_cached_per_m: 5 },
] as const;

export type FixtureEvent = {
  event_id: string;
  ts: string;
  model: string;
  tokens_in?: number;
  tokens_out?: number;
  cached_tokens?: number;
  latency_ms?: number;
  status?: string;
  task_id?: string | null;
};

export async function resetDb(): Promise<void> {
  await query("TRUNCATE TABLE llm_events, models RESTART IDENTITY");

  for (const model of MODELS) {
    await query(
      `INSERT INTO models (name, price_in_per_m, price_out_per_m, price_cached_per_m)
       VALUES ($1, $2, $3, $4)`,
      [model.name, model.price_in_per_m, model.price_out_per_m, model.price_cached_per_m],
    );
  }
}

export async function seedEvents(events: FixtureEvent[]): Promise<void> {
  for (const event of events) {
    await query(
      `INSERT INTO llm_events
         (event_id, ts, model_id, tokens_in, tokens_out, cached_tokens, latency_ms, status, cost_rub, task_id)
       SELECT $1, $2, m.id, $4::int, $5::int, $6::int, $7::int, $8,
              $4::int::numeric / 1000000 * m.price_in_per_m
                + $5::int::numeric / 1000000 * m.price_out_per_m
                + $6::int::numeric / 1000000 * m.price_cached_per_m,
              $9
       FROM models m
       WHERE m.name = $3`,
      [
        event.event_id,
        event.ts,
        event.model,
        event.tokens_in ?? 0,
        event.tokens_out ?? 0,
        event.cached_tokens ?? 0,
        event.latency_ms ?? 0,
        event.status ?? "ok",
        event.task_id ?? null,
      ],
    );
  }
}
