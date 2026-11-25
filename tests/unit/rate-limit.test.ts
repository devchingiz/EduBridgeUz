import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: vi.fn(),
    rateLimitCounter: { findUnique: mocks.findUnique },
  },
}));

import { db } from "@/lib/db";
import { checkRateLimits, rateLimit } from "@/lib/security/rate-limit";

const options = {
  scope: "auth.signin.v1.email",
  identifier: "student@example.com",
  limit: 10,
  windowSeconds: 60,
};

function currentWindowStart(): Date {
  const windowMs = options.windowSeconds * 1000;
  return new Date(Math.floor(Date.now() / windowMs) * windowMs);
}

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("rate-limit failure handling", () => {
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

describe("checkRateLimits", () => {
  it("reports an exhausted counter without incrementing it", async () => {
    mocks.findUnique.mockResolvedValue({
      count: 11,
      windowStart: currentWindowStart(),
    });

    const result = await checkRateLimits([options]);

    expect(result).not.toBeNull();
    expect(result?.allowed).toBe(false);
    expect(result?.retryAfterSeconds).toBeGreaterThan(0);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it("ignores a counter from a previous window", async () => {
    mocks.findUnique.mockResolvedValue({
      count: 99,
      windowStart: new Date(currentWindowStart().getTime() - 60_000),
    });

    await expect(checkRateLimits([options])).resolves.toBeNull();
  });

  it("fails closed when the counter cannot be read", async () => {
    mocks.findUnique.mockRejectedValue(new Error("database unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await checkRateLimits([options]);

    expect(result).toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 30,
      limit: options.limit,
    });
  });
});
