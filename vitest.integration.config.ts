import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

const env = loadEnv("test", process.cwd(), "");
const { DATABASE_URL: _databaseUrl, ...testEnv } = env;
const externalIntegrationUrl =
  process.env.STAGING_CONFIRM === "STAGING" &&
  process.env.STAGING_CONFIRM_TESTS === "TESTS"
    ? process.env.STAGING_INTEGRATION_DATABASE_URL?.trim()
    : undefined;

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["./tests/integration/global-setup.ts"],
    setupFiles: ["./tests/integration/setup-env.ts"],
    env: {
      ...testEnv,
      ...(externalIntegrationUrl
        ? { DATABASE_URL: externalIntegrationUrl }
        : {}),
      EMAIL_TRANSPORT: "console",
      EMAIL_VERIFICATION_ENFORCEMENT_START: "2026-01-01T00:00:00.000Z",
    },
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
