-- 001_init.sql — initial schema for llm-meter
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS models (
  id serial PRIMARY KEY,
  name text UNIQUE NOT NULL,
  price_in_per_m numeric(12, 4) NOT NULL DEFAULT 0,
  price_out_per_m numeric(12, 4) NOT NULL DEFAULT 0,
  price_cached_per_m numeric(12, 4) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS llm_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE NOT NULL,
  ts timestamptz NOT NULL,
  model_id int NOT NULL REFERENCES models (id),
  tokens_in int NOT NULL DEFAULT 0,
  tokens_out int NOT NULL DEFAULT 0,
  cached_tokens int NOT NULL DEFAULT 0,
  latency_ms int NOT NULL DEFAULT 0,
  status text NOT NULL,
  cost_rub numeric(12, 6) NOT NULL DEFAULT 0,
  task_id text,
  meta jsonb
);

CREATE INDEX IF NOT EXISTS idx_llm_events_ts ON llm_events (ts);
CREATE INDEX IF NOT EXISTS idx_llm_events_model_id ON llm_events (model_id);
