import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { $queryRaw: vi.fn() },
}));

import { db } from "@/lib/db";
import { rateLimit } from "@/lib/security/rate-limit";

describe("rate-limit failure handling", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("fails closed when the shared counter cannot be updated", async () => {
    vi.mocked(db.$queryRaw).mockRejectedValue(
      new Error("database credentials must not be logged"),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await rateLimit({
      scope: "auth.login.ip",
      identifier: "192.0.2.1",
      limit: 5,
      windowSeconds: 60,
    });

    expect(result).toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 30,
      limit: 5,
    });
    expect(String(vi.mocked(console.error).mock.calls[0]?.[0])).not.toContain(
      "credentials",
    );
  });
});
