import { closePool, query } from "../src/db.js";

type ModelRow = {
  id: number;
  name: string;
  price_in_per_m: string;
  price_out_per_m: string;
  price_cached_per_m: string;
};

type SeedEvent = {
  event_id: string;
  ts: string;
  model_id: number;
  tokens_in: number;
  tokens_out: number;
  cached_tokens: number;
  latency_ms: number;
  status: string;
  cost_rub: number;
  task_id: string;
};

const MODELS = [
  { name: "gpt-4o-mini", price_in_per_m: 15, price_out_per_m: 60, price_cached_per_m: 7.5 },
  { name: "gpt-4o", price_in_per_m: 250, price_out_per_m: 1000, price_cached_per_m: 125 },
  { name: "claude-3-5-sonnet", price_in_per_m: 300, price_out_per_m: 1500, price_cached_per_m: 150 },
  { name: "llama-3-1-70b", price_in_per_m: 10, price_out_per_m: 40, price_cached_per_m: 5 },
];

const EVENTS_TOTAL = 5000;
const BATCH_SIZE = 500;
const EVENT_COLUMNS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function costOf(event: SeedEvent, model: ModelRow): number {
  return (
    (event.tokens_in / 1e6) * Number(model.price_in_per_m) +
    (event.tokens_out / 1e6) * Number(model.price_out_per_m) +
    (event.cached_tokens / 1e6) * Number(model.price_cached_per_m)
  );
}

async function insertBatch(events: SeedEvent[]): Promise<number> {
  const values: unknown[] = [];
  const placeholders = events.map((event, index) => {
    const base = index * EVENT_COLUMNS;
    values.push(
      event.event_id,
      event.ts,
      event.model_id,
      event.tokens_in,
      event.tokens_out,
      event.cached_tokens,
      event.latency_ms,
      event.status,
      event.cost_rub,
      event.task_id,
    );
    const slots = Array.from({ length: EVENT_COLUMNS }, (_, offset) => `$${base + offset + 1}`);
    return `(${slots.join(", ")})`;
  });

  const res = await query(
    `INSERT INTO llm_events
       (event_id, ts, model_id, tokens_in, tokens_out, cached_tokens, latency_ms, status, cost_rub, task_id)
     VALUES ${placeholders.join(", ")}
     ON CONFLICT (event_id) DO NOTHING`,
    values,
  );

  return res.rowCount ?? 0;
}

async function main(): Promise<void> {
  for (const model of MODELS) {
    await query(
      `INSERT INTO models (name, price_in_per_m, price_out_per_m, price_cached_per_m)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (name) DO NOTHING`,
      [model.name, model.price_in_per_m, model.price_out_per_m, model.price_cached_per_m],
    );
  }

  const models = await query<ModelRow>(
    "SELECT id, name, price_in_per_m, price_out_per_m, price_cached_per_m FROM models ORDER BY id",
  );
  if (models.rows.length === 0) {
    throw new Error("no models in table models");
  }

  const now = Date.now();
  let inserted = 0;

  for (let start = 0; start < EVENTS_TOTAL; start += BATCH_SIZE) {
    const batch: SeedEvent[] = [];

    for (let index = start; index < Math.min(start + BATCH_SIZE, EVENTS_TOTAL); index += 1) {
      const model = models.rows[randInt(0, models.rows.length - 1)]!;
      const event: SeedEvent = {
        // Deterministic ids keep the seed idempotent across runs.
        event_id: `seed-${index + 1}`,
        ts: new Date(now - randInt(0, 30 * DAY_MS)).toISOString(),
        model_id: model.id,
        tokens_in: randInt(100, 4000),
        tokens_out: randInt(50, 2000),
        cached_tokens: randInt(0, 1000),
        latency_ms: randInt(200, 8000),
        status: randInt(1, 100) <= 10 ? "error" : "ok",
        cost_rub: 0,
        task_id: `task-${randInt(1, 500)}`,
      };
      event.cost_rub = costOf(event, model);
      batch.push(event);
    }

    inserted += await insertBatch(batch);
  }

  const total = await query<{ total: number }>("SELECT count(*)::int AS total FROM llm_events");

  console.log(`inserted ${inserted} events, total in llm_events: ${total.rows[0]?.total ?? 0}`);
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await closePool();
}
