import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const envPath = fileURLToPath(new URL("../.env.test", import.meta.url));

/**
 * Loads .env.test into process.env without overriding variables that are already set.
 * In CI the file does not exist and the values come from the job environment.
 */
export function loadTestEnv(): void {
  let contents: string;
  try {
    contents = readFileSync(envPath, "utf8");
  } catch {
    return;
  }

  for (const line of contents.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) {
      continue;
    }
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) {
      continue;
    }
    process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, "$2");
  }
}
