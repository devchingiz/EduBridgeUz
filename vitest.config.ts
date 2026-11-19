import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

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
    include: ["tests/unit/**/*.test.ts"],
    env: {
      AUTH_SECRET: "unit-test-secret-value-that-is-long-enough",
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
    },
  },
});
