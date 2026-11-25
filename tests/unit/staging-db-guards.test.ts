import { describe, expect, it } from "vitest";

import {
  assessMigrationHistory,
  assertEmptyStagingDatabase,
  assertStagingVerificationAllowed,
  inspectStagingUrl,
  redactConnectionDetails,
} from "../../scripts/staging-db-guards.mjs";

const POOLED_URL =
  "postgresql://app:super-secret@staging-pooler.example:5432/edubridge_staging?schema=public&sslmode=verify-full&channel_binding=require&connect_timeout=10&pool_timeout=10&connection_limit=5";
const DIRECT_URL =
  "postgresql://migrator:migration-secret@staging.example:5432/edubridge_staging?schema=public&sslmode=verify-full&channel_binding=require&connect_timeout=10";

const baseInput = {
  pooledUrl: POOLED_URL,
  directUrl: DIRECT_URL,
  confirm: "STAGING",
};

describe("staging database guards", () => {
  it("requires explicit staging confirmation", () => {
    expect(() =>
      assertStagingVerificationAllowed({ ...baseInput, confirm: undefined }),
    ).toThrow(/STAGING_CONFIRM=STAGING/);
  });

  it("accepts validating TLS, finite timeouts, and a bounded pool", () => {
    const result = assertStagingVerificationAllowed(baseInput);
    expect(result.pooled.certValidatingTls).toBe(true);
    expect(result.direct.certValidatingTls).toBe(true);
    expect(result.pooled.connectionLimit).toBe(true);
  });

  it("refuses encrypted but non-validating TLS", () => {
    let message = "";
    try {
      assertStagingVerificationAllowed({
        ...baseInput,
        pooledUrl: POOLED_URL.replace("verify-full", "require"),
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toMatch(/sslmode=verify-ca or sslmode=verify-full/);
    expect(message).not.toContain("super-secret");
  });

  it("checks a provider-specific pooled host marker", () => {
    expect(() =>
      assertStagingVerificationAllowed({
        ...baseInput,
        pooledHostMarker: "-pooler",
      }),
    ).not.toThrow();
    expect(() =>
      assertStagingVerificationAllowed({
        ...baseInput,
        directUrl: DIRECT_URL.replace(
          "staging.example",
          "staging-pooler.example",
        ),
        pooledHostMarker: "-pooler",
      }),
    ).toThrow(/host marker/);
    expect(() =>
      assertStagingVerificationAllowed({
        ...baseInput,
        pooledUrl: POOLED_URL.replace("-pooler", ""),
        pooledHostMarker: "-pooler",
      }),
    ).toThrow(/host marker/);
  });

  it("refuses an explicitly forbidden database identity", () => {
    expect(() =>
      assertStagingVerificationAllowed({
        ...baseInput,
        forbiddenIdentity:
          "postgresql://staging-pooler.example:5432/edubridge_staging",
      }),
    ).toThrow(/forbidden database identity/);
  });

  it("requires a bounded app connection pool on the pooled endpoint", () => {
    expect(() =>
      assertStagingVerificationAllowed({
        ...baseInput,
        pooledUrl: POOLED_URL.replace(
          "connection_limit=5",
          "connection_limit=0",
        ),
      }),
    ).toThrow(/connection_limit/);
  });

  it("reports URL facts without credentials", () => {
    const facts = inspectStagingUrl(POOLED_URL, "STAGING_DATABASE_URL");
    expect(facts.hostname).toBe("staging-pooler.example");
    expect(facts.database).toBe("edubridge_staging");
    expect(facts.identity).not.toContain("super-secret");
  });

  it("requires an empty database for a migration replay", () => {
    expect(() =>
      assertEmptyStagingDatabase({ userTables: 1, migrationRows: 0 }),
    ).toThrow(/empty database/);
    expect(() =>
      assertEmptyStagingDatabase({
        userTables: 1,
        migrationRows: 0,
        allowExisting: "YES",
      }),
    ).not.toThrow();
  });

  it("compares applied migrations with committed history", () => {
    const result = assessMigrationHistory(
      [
        { migrationName: "a", finished: true, rolledBack: false },
        { migrationName: "b", finished: false, rolledBack: false },
      ],
      ["a", "b"],
    );
    expect(result.complete).toBe(false);
    expect(result.unsuccessful).toEqual(["b"]);
  });

  it("redacts connection strings and decoded secrets from output", () => {
    const output = redactConnectionDetails(
      `failed connecting to ${POOLED_URL} with password super-secret`,
      [POOLED_URL, DIRECT_URL],
    );
    expect(output).not.toContain("super-secret");
    expect(output).not.toContain("migration-secret");
    expect(output).not.toContain("postgresql://");
  });
});
