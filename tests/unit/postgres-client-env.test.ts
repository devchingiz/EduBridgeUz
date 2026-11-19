import { describe, expect, it } from "vitest";

import { postgresClientEnvironment } from "../../scripts/postgres-client-env.mjs";

describe("PostgreSQL backup client environment", () => {
  it("maps a URL to libpq variables without retaining Prisma-only options", () => {
    const env = postgresClientEnvironment(
      "postgresql://backup%40user:p%40ss%3Aword@db.example.test:5433/edu%20bridge?schema=public&pgbouncer=true&sslmode=require&application_name=edubridge-backup",
      {
        PATH: "path",
        NODE_ENV: "test",
        DATABASE_URL: "postgresql://secret@host/database",
      },
    );

    expect(env).toMatchObject({
      PATH: "path",
      PGHOST: "db.example.test",
      PGPORT: "5433",
      PGDATABASE: "edu bridge",
      PGUSER: "backup@user",
      PGPASSWORD: "p@ss:word",
      PGSSLMODE: "require",
      PGAPPNAME: "edubridge-backup",
    });
    expect(env).not.toHaveProperty("DATABASE_URL");
    expect(env).not.toHaveProperty("PGBOUNCER");
    expect(env).not.toHaveProperty("NODE_ENV");
  });

  it("rejects malformed or non-PostgreSQL connection strings", () => {
    expect(() => postgresClientEnvironment("not-a-url")).toThrow(
      "connection string is invalid",
    );
    expect(() => postgresClientEnvironment("mysql://host/database")).toThrow(
      "must use PostgreSQL",
    );
  });
});
