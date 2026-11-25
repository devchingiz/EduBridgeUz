import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cachedRangeCountForTests,
  isPasswordBreached,
  resetBreachedPasswordCacheForTests,
  shouldCheckBreaches,
} from "@/lib/security/breached-password";
import { enforcePasswordPolicy } from "@/lib/security/password";

const fetchMock = vi.fn();

function digest(password: string): string {
  return createHash("sha1")
    .update(password, "utf8")
    .digest("hex")
    .toUpperCase();
}

function mockRangeResponse(suffixes: string[] = []) {
  const body = suffixes.map((suffix) => `${suffix}:12345`).join("\r\n");
  return {
    ok: true,
    text: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  resetBreachedPasswordCacheForTests();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("HIBP_ENABLED", "true");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetBreachedPasswordCacheForTests();
});

describe("HIBP k-anonymity client", () => {
  it("sends only the five-character SHA-1 prefix", async () => {
    fetchMock.mockResolvedValue(mockRangeResponse());
    const password = "Correct-Horse-Battery-9";

    expect(await isPasswordBreached(password)).toEqual({
      ok: true,
      breached: false,
    });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `https://api.pwnedpasswords.com/range/${digest(password).slice(0, 5)}`,
    );
    expect(JSON.stringify([url, options])).not.toContain(password);
    expect(JSON.stringify([url, options])).not.toContain(digest(password));
    expect(options.headers).toMatchObject({ "Add-Padding": "true" });
  });

  it("detects a breached suffix and treats clean suffixes as safe", async () => {
    const breached = "breached-password-value";
    fetchMock.mockResolvedValue(mockRangeResponse([digest(breached).slice(5)]));

    expect(await isPasswordBreached(breached)).toEqual({
      ok: true,
      breached: true,
    });
    expect(await isPasswordBreached("clean-password-value")).toEqual({
      ok: true,
      breached: false,
    });
  });

  it("caches a range and bounds the cache to a fixed number of prefixes", async () => {
    fetchMock.mockResolvedValue(mockRangeResponse());
    const password = "cached-password-value";

    await isPasswordBreached(password);
    await isPasswordBreached(password);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    for (let index = 0; index < 300; index += 1) {
      await isPasswordBreached(`password-${index}`);
    }

    expect(cachedRangeCountForTests()).toBeLessThanOrEqual(256);
    expect(fetchMock).toHaveBeenCalledTimes(301);
  });

  it("expires cached ranges after the TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    fetchMock.mockResolvedValue(mockRangeResponse());

    const password = "ttl-password-value";
    await isPasswordBreached(password);
    vi.setSystemTime(new Date("2026-01-02T00:00:00.000Z"));
    await isPasswordBreached(password);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails closed on network errors, non-200 responses, and oversized bodies", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    expect(await isPasswordBreached("network-password")).toEqual({
      ok: false,
      reason: "unavailable",
    });

    fetchMock.mockResolvedValueOnce({ ok: false } as Response);
    expect(await isPasswordBreached("status-password")).toEqual({
      ok: false,
      reason: "unavailable",
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () => "x".repeat(200_001),
    } as Response);
    expect(await isPasswordBreached("oversize-password")).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("is opt-in outside production and always enforced in production", async () => {
    vi.stubEnv("HIBP_ENABLED", "");
    expect(shouldCheckBreaches()).toBe(false);
    expect(
      await enforcePasswordPolicy("locally-valid-password", {
        email: "student@example.com",
      }),
    ).toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();

    vi.stubEnv("NODE_ENV", "production");
    expect(shouldCheckBreaches()).toBe(true);
    fetchMock.mockRejectedValue(new Error("offline"));
    const result = await enforcePasswordPolicy("locally-valid-password", {
      email: "student@example.com",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toMatch(/could not verify/i);
    }
  });

  it("returns a safe error when the password is breached", async () => {
    const password = "safe-looking-password";
    fetchMock.mockResolvedValue(mockRangeResponse([digest(password).slice(5)]));

    const result = await enforcePasswordPolicy(password, {
      email: "student@example.com",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toMatch(/known data breach/i);
      expect(result.errors.join(" ")).not.toContain(password);
    }
  });
});
