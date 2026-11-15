import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { resetDb, seedEvents } from "./fixtures.js";

const FROM = "2026-11-01T00:00:00.000Z";
const TO = "2026-11-11T00:00:00.000Z";

let app: FastifyInstance;
let token: string;

const events = [
  { event_id: "evt-1", ts: "2026-11-03T09:00:00.000Z", model: "gpt-4o-mini", tokens_in: 1000, tokens_out: 500, status: "ok" },
  { event_id: "evt-2", ts: "2026-11-03T15:00:00.000Z", model: "gpt-4o", tokens_in: 2000, tokens_out: 900, status: "error" },
  { event_id: "evt-3", ts: "2026-11-04T10:00:00.000Z", model: "claude-3-5-sonnet", tokens_in: 3000, tokens_out: 1200, status: "ok" },
  { event_id: "evt-4", ts: "2026-11-04T11:00:00.000Z", model: "llama-3-1-70b", tokens_in: 4000, tokens_out: 1600, status: "ok" },
  { event_id: "evt-5", ts: "2026-11-05T12:00:00.000Z", model: "gpt-4o-mini", tokens_in: 500, tokens_out: 200, status: "ok" },
];

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  const response = await request(app.server).post("/auth/login").send({ login: "admin", password: "admin" });
  token = response.body.token as string;
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await resetDb();
  await seedEvents(events);
});

function sumCost(rows: Array<{ cost_rub: number | string }>): number {
  return rows.reduce((sum, row) => sum + Number(row.cost_rub), 0);
}

describe("GET /stats", () => {
  it("group=day: сумма events по дням = total из /events, cost_rub сходится", async () => {
    const stats = await request(app.server)
      .get(`/stats?group=day&from=${FROM}&to=${TO}`)
      .set("Authorization", `Bearer ${token}`);
    expect(stats.status).toBe(200);
    expect(stats.body.group).toBe("day");

    const eventsResponse = await request(app.server)
      .get(`/events?limit=500&from=${FROM}&to=${TO}`)
      .set("Authorization", `Bearer ${token}`);
    expect(eventsResponse.status).toBe(200);
    expect(eventsResponse.body.total).toBe(5);

    const statsEvents = stats.body.rows.reduce((sum: number, row: { events: number }) => sum + row.events, 0);
    expect(statsEvents).toBe(eventsResponse.body.total);
    expect(sumCost(stats.body.rows)).toBeCloseTo(sumCost(eventsResponse.body.items), 6);
  });

  it("group=model: 4 строки (4 модели), сумма cost_rub сходится с /events", async () => {
    const stats = await request(app.server)
      .get(`/stats?group=model&from=${FROM}&to=${TO}`)
      .set("Authorization", `Bearer ${token}`);
    expect(stats.status).toBe(200);
    expect(stats.body.group).toBe("model");
    expect(stats.body.rows).toHaveLength(4);

    const eventsResponse = await request(app.server)
      .get(`/events?limit=500&from=${FROM}&to=${TO}`)
      .set("Authorization", `Bearer ${token}`);

    expect(sumCost(stats.body.rows)).toBeCloseTo(sumCost(eventsResponse.body.items), 6);
  });

  it("group=year (неизвестный) → 400", async () => {
    const response = await request(app.server).get("/stats?group=year").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(400);
  });
});
