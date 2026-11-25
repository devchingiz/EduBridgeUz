import { describe, expect, it } from "vitest";

import {
  assertEmptyRestoreBucket,
  assertRestoreTargetIsIsolated,
  parseDatabaseIdentity,
} from "../../scripts/restore-guards.mjs";

const PRODUCTION =
  "postgresql://app:secret@db.internal:5432/edubridge?sslmode=require";

describe("restore database target guards", () => {
  it("normalises equivalent PostgreSQL URLs for comparison", () => {
    const a = parseDatabaseIdentity(PRODUCTION);
    const b = parseDatabaseIdentity(
      "postgres://APP:other@DB.INTERNAL/edubridge/",
    );

    expect(a.identity).toBe("postgresql://db.internal:5432/edubridge");
    expect(b.identity).toBe(a.identity);
    expect(a.database).toBe("edubridge");
  });

  it.each([
    "not a url",
    "https://db.internal/edubridge",
    "postgresql://db.internal/",
  ])("rejects invalid URL %s", (value) => {
    expect(() => parseDatabaseIdentity(value)).toThrow();
  });

  it("requires an explicitly named, distinct recovery database", () => {
    expect(
      assertRestoreTargetIsIsolated({
        databaseUrl: PRODUCTION,
        restoreUrl: "postgresql://app@db.internal:5432/edubridge_restore",
        targetName: "edubridge_restore",
      }),
    ).toMatchObject({ database: "edubridge_restore" });
  });

  it("blocks a production target even when the URL is spelled differently", () => {
    expect(() =>
      assertRestoreTargetIsIsolated({
        databaseUrl: PRODUCTION,
        restoreUrl: "postgres://app@DB.INTERNAL/edubridge",
        targetName: "edubridge",
      }),
    ).toThrow(/separate recovery database/);
  });

  it("blocks the same database name on a different host", () => {
    expect(() =>
      assertRestoreTargetIsIsolated({
        databaseUrl: PRODUCTION,
        restoreUrl: "postgresql://app@other.internal:5432/edubridge",
        targetName: "edubridge",
      }),
    ).toThrow(/database name must differ/);
  });

  it("requires a matching explicit target name and a production URL", () => {
    expect(() =>
      assertRestoreTargetIsIsolated({
        databaseUrl: PRODUCTION,
        restoreUrl: "postgresql://app@db.internal:5432/edubridge_restore",
        targetName: "edubridge",
      }),
    ).toThrow(/RESTORE_TARGET_NAME/);

    expect(() =>
      assertRestoreTargetIsIsolated({
        databaseUrl: undefined,
        restoreUrl: "postgresql://app@db.internal:5432/edubridge_restore",
        targetName: "edubridge_restore",
      }),
    ).toThrow(/PostgreSQL URL is required/);
  });
});

describe("restore document bucket guard", () => {
  const list =
    (result: {
      KeyCount?: number;
      Contents?: unknown[];
      IsTruncated?: boolean;
    }) =>
    async () =>
      result;

  it("accepts an empty destination bucket", async () => {
    await expect(
      assertEmptyRestoreBucket(list({ KeyCount: 0 }), "recovery-docs"),
    ).resolves.toBeUndefined();
  });

  it("rejects a destination with objects or a truncated listing", async () => {
    await expect(
      assertEmptyRestoreBucket(
        list({ Contents: [{ Key: "documents/existing" }] }),
        "recovery-docs",
      ),
    ).rejects.toThrow(/must be empty/);
    await expect(
      assertEmptyRestoreBucket(list({ IsTruncated: true }), "recovery-docs"),
    ).rejects.toThrow(/must be empty/);
  });

  it("requires a bucket name", async () => {
    await expect(
      assertEmptyRestoreBucket(list({ KeyCount: 0 }), "  "),
    ).rejects.toThrow(/bucket is required/);
  });
});
