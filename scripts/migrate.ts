import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { closePool, query, withTransaction } from "../src/db.js";

// dist/scripts/migrate.js resolves two levels up, scripts/migrate.ts (vitest) one level up.
const migrationsDir = ["../../db/migrations/", "../db/migrations/"]
  .map((relative) => fileURLToPath(new URL(relative, import.meta.url)))
  .find((dir) => existsSync(dir));

if (!migrationsDir) {
  throw new Error(`db/migrations not found next to ${import.meta.url}`);
}

// Явный тип: narrowing не переносится в тело функции.
const migrationsPath: string = migrationsDir;


export async function runMigrations(): Promise<void> {
  await query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  );

  const applied = await query<{ name: string }>("SELECT name FROM schema_migrations");
  const appliedNames = new Set(applied.rows.map((row) => row.name));

  const files = (await readdir(migrationsPath)).filter((file) => file.endsWith(".sql")).sort();

  for (const file of files) {
    if (appliedNames.has(file)) {
      console.log(`skip ${file}`);
      continue;
    }

    const sql = await readFile(path.join(migrationsPath, file), "utf8");
    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
    });
    console.log(`applied ${file}`);
  }
}

// Run as a CLI (`npm run migrate`) only when executed directly; tests import runMigrations().
const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    await runMigrations();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
