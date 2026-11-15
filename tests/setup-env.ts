import { afterAll } from "vitest";
import { loadTestEnv } from "./load-env.js";

loadTestEnv();

// The pool lives in the test file's module graph, so close it here to let the worker exit.
afterAll(async () => {
  const { closePool } = await import("../src/db.js");
  await closePool();
});
