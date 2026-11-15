import { loadTestEnv } from "./load-env.js";

export default async function setup(): Promise<void> {
  loadTestEnv();

  const { runMigrations } = await import("../scripts/migrate.js");
  const { closePool } = await import("../src/db.js");

  try {
    await runMigrations();
  } finally {
    await closePool();
  }
}
