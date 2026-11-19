import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { rateLimit } from "@/lib/security/rate-limit";

beforeEach(async () => {
  await db.rateLimitCounter.deleteMany();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("database-backed rate limits", () => {
  it("enforces one shared limit across concurrent requests", async () => {
    const results = await Promise.all(
      Array.from({ length: 24 }, () =>
        rateLimit({
          scope: "test.concurrent",
          identifier: "same-account",
          limit: 5,
          windowSeconds: 60,
        }),
      ),
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(5);
    expect(results.filter((result) => !result.allowed)).toHaveLength(19);
    await expect(db.rateLimitCounter.count()).resolves.toBe(1);
  });
});
