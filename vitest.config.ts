import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/setup-env.ts"],
    // One database for the whole run: test files must not overlap.
    fileParallelism: false,
  },
});
