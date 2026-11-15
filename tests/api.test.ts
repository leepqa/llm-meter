import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { query } from "../src/db.js";
import { resetDb, seedEvents } from "./fixtures.js";

const LOGIN = "admin";
const PASSWORD = "admin";

let app: FastifyInstance;
let token: string;

function api() {
  return request(app.server);
}

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  const response = await request(app.server).post("/auth/login").send({ login: LOGIN, password: PASSWORD });
  token = response.body.token as string;
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await resetDb();
});

describe("health", () => {
  it("GET /health → 200 {status:'ok', db:'up'}", async () => {
    const response = await api().get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", db: "up" });
  });
});

describe("auth", () => {
  it("POST /auth/login с верным паролем → 200 и JWT в token", async () => {
    const response = await api().post("/auth/login").send({ login: LOGIN, password: PASSWORD });
    expect(response.status).toBe(200);
    expect(typeof response.body.token).toBe("string");
    expect(response.body.token.split(".")).toHaveLength(3);
  });

  it("POST /auth/login с неверным паролем → 401", async () => {
    const response = await api().post("/auth/login").send({ login: LOGIN, password: "wrong-password" });
    expect(response.status).toBe(401);
  });

  // Спека требует 400 на пустое тело. API сейчас отвечает 401 — тест оставлен падающим намеренно.
  it("POST /auth/login с пустым телом ({}) → 400", async () => {
    const response = await api().post("/auth/login").send({});
    expect(response.status).toBe(400);
  });
});

describe("защищённые ручки", () => {
  it("GET /events без токена → 401", async () => {
    const response = await api().get("/events");
    expect(response.status).toBe(401);
  });

  it("GET /events с битым токеном → 401", async () => {
    const response = await api().get("/events").set("Authorization", "Bearer garbage");
    expect(response.status).toBe(401);
  });
});

describe("POST /ingest", () => {
  const event = {
    event_id: "evt-ingest-1",
    ts: "2026-11-10T10:00:00.000Z",
    model: "gpt-4o-mini",
    tokens_in: 1000,
    tokens_out: 500,
    cached_tokens: 0,
    latency_ms: 120,
    status: "ok",
    task_id: "task-1",
  };

  it("новое событие → 200/201, inserted:1 и запись реально в БД", async () => {
    const response = await api().post("/ingest").set("Authorization", `Bearer ${token}`).send(event);
    expect([200, 201]).toContain(response.status);
    expect(response.body).toMatchObject({ received: 1, inserted: 1, duplicates: 0 });

    const rows = await query<{ model: string; cost_rub: string }>(
      `SELECT m.name AS model, e.cost_rub::text AS cost_rub
       FROM llm_events e
       JOIN models m ON m.id = e.model_id
       WHERE e.event_id = $1`,
      [event.event_id],
    );
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0]!.model).toBe("gpt-4o-mini");
    expect(Number(rows.rows[0]!.cost_rub)).toBeGreaterThan(0);
  });

  it("повтор с тем же event_id → inserted:0, duplicates:1, в БД один ряд", async () => {
    await api().post("/ingest").set("Authorization", `Bearer ${token}`).send(event);
    const response = await api().post("/ingest").set("Authorization", `Bearer ${token}`).send(event);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ received: 1, inserted: 0, duplicates: 1 });

    const rows = await query<{ total: number }>(
      "SELECT count(*)::int AS total FROM llm_events WHERE event_id = $1",
      [event.event_id],
    );
    expect(rows.rows[0]!.total).toBe(1);
  });

  it("невалидное тело (нет model, tokens_in:'abc') → 400 и упомянуто проблемное поле", async () => {
    const response = await api()
      .post("/ingest")
      .set("Authorization", `Bearer ${token}`)
      .send({ event_id: "evt-bad", ts: "2026-11-10T10:00:00.000Z", status: "ok", tokens_in: "abc" });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/model|tokens_in/);
  });
});

describe("GET /events", () => {
  const events = [
    { event_id: "evt-1", ts: "2026-11-10T09:00:00.000Z", model: "gpt-4o-mini", tokens_in: 100, tokens_out: 50, status: "ok" },
    { event_id: "evt-2", ts: "2026-11-10T10:00:00.000Z", model: "gpt-4o", tokens_in: 200, tokens_out: 80, status: "error" },
    { event_id: "evt-3", ts: "2026-11-10T11:00:00.000Z", model: "claude-3-5-sonnet", tokens_in: 300, tokens_out: 120, status: "ok" },
    { event_id: "evt-4", ts: "2026-11-10T12:00:00.000Z", model: "llama-3-1-70b", tokens_in: 400, tokens_out: 160, status: "error" },
    { event_id: "evt-5", ts: "2026-11-10T13:00:00.000Z", model: "gpt-4o-mini", tokens_in: 500, tokens_out: 200, status: "ok" },
  ];

  beforeEach(async () => {
    await seedEvents(events);
  });

  it("limit/offset и корректный total", async () => {
    const first = await api().get("/events?limit=2&offset=0").set("Authorization", `Bearer ${token}`);
    expect(first.status).toBe(200);
    expect(first.body.total).toBe(5);
    expect(first.body.items).toHaveLength(2);

    const second = await api().get("/events?limit=2&offset=2").set("Authorization", `Bearer ${token}`);
    expect(second.body.total).toBe(5);
    expect(second.body.items).toHaveLength(2);

    const third = await api().get("/events?limit=2&offset=4").set("Authorization", `Bearer ${token}`);
    expect(third.body.total).toBe(5);
    expect(third.body.items).toHaveLength(1);
  });

  it("фильтр по model → только эта модель", async () => {
    const response = await api().get("/events?model=gpt-4o-mini").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.total).toBe(2);
    expect(response.body.items.every((item: { model: string }) => item.model === "gpt-4o-mini")).toBe(true);
  });

  it("фильтр по status=error → только error", async () => {
    const response = await api().get("/events?status=error").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.total).toBe(2);
    expect(response.body.items.every((item: { status: string }) => item.status === "error")).toBe(true);
  });
});
