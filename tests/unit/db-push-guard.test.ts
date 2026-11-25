import { describe, expect, it } from "vitest";

import { assertLocalDatabasePushAllowed } from "../../scripts/db-push-guard.mjs";

const LOCAL_URL =
  "postgresql://postgres:postgres@127.0.0.1:5432/postgres?schema=public&pgbouncer=true";

describe("db push guard", () => {
  it("allows a local development database", () => {
    expect(() =>
      assertLocalDatabasePushAllowed({
        databaseUrl: LOCAL_URL,
        nodeEnv: "development",
      }),
    ).not.toThrow();
  });

  it("refuses production even when the URL points at loopback", () => {
    expect(() =>
      assertLocalDatabasePushAllowed({
        databaseUrl: LOCAL_URL,
        nodeEnv: "production",
      }),
    ).toThrow(/disabled in production/);
  });

  it("refuses non-loopback hosts without exposing credentials", () => {
    let message = "";
    try {
      assertLocalDatabasePushAllowed({
        databaseUrl:
          "postgresql://edubridge:super-secret@db.example:5432/edubridge?sslmode=require",
        nodeEnv: "development",
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toMatch(/loopback/);
    expect(message).not.toContain("super-secret");
    expect(message).not.toContain("db.example");
  });
});
