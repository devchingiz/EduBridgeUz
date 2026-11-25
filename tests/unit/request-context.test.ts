import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  appUrl: { value: "https://edubridge.example" },
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/lib/env", () => ({
  getAppUrl: () => mocks.appUrl.value,
}));

import {
  assertSameOrigin,
  getRequestContext,
  hasClientIp,
} from "@/lib/http/request";

function setHeaders(entries: Record<string, string> = {}): void {
  mocks.headers.mockResolvedValue(new Headers(entries));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.appUrl.value = "https://edubridge.example";
  setHeaders();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("hasClientIp", () => {
  it.each(["203.0.113.42", "2001:db8::1", "::ffff:198.51.100.7"])(
    "accepts valid IP address %s",
    (ip) => {
      expect(hasClientIp(ip)).toBe(true);
    },
  );

  it.each([
    "",
    " ",
    "\t\n",
    "unknown",
    " UNKNOWN ",
    null,
    undefined,
    "attacker-1",
    "999.999.999.999",
    "192.168.1.1:8080",
    "unknown, 203.0.113.42",
  ])("rejects unavailable or malformed value %j", (ip) => {
    expect(hasClientIp(ip)).toBe(false);
  });
});

describe("getRequestContext", () => {
  it("returns the shared sentinel when no client address headers are present", async () => {
    const context = await getRequestContext();

    expect(context).toEqual({ ip: "unknown", userAgent: null });
  });

  it("prefers x-forwarded-for over x-real-ip", async () => {
    setHeaders({
      "x-forwarded-for": "203.0.113.42, 10.0.0.1",
      "x-real-ip": "198.51.100.7",
      "user-agent": "test-agent",
    });

    const context = await getRequestContext();

    expect(context).toEqual({ ip: "203.0.113.42", userAgent: "test-agent" });
  });

  it("uses x-real-ip when x-forwarded-for is missing", async () => {
    setHeaders({ "x-real-ip": "2001:db8::1" });

    await expect(getRequestContext()).resolves.toMatchObject({
      ip: "2001:db8::1",
    });
  });

  it.each(["", "   ", "unknown", "attacker-1", "999.999.999.999"])(
    "falls back from malformed x-forwarded-for %j to a valid x-real-ip",
    async (forwarded) => {
      setHeaders({
        "x-forwarded-for": forwarded,
        "x-real-ip": "198.51.100.7",
      });

      await expect(getRequestContext()).resolves.toMatchObject({
        ip: "198.51.100.7",
      });
    },
  );

  it("does not accept a non-leftmost forwarded address", async () => {
    setHeaders({
      "x-forwarded-for": "attacker-1, 203.0.113.42",
      "x-real-ip": "198.51.100.7",
    });

    await expect(getRequestContext()).resolves.toMatchObject({
      ip: "198.51.100.7",
    });
  });

  it("returns the sentinel when every candidate header is malformed", async () => {
    setHeaders({
      "x-forwarded-for": "attacker-1",
      "x-real-ip": "not-an-ip",
    });

    await expect(getRequestContext()).resolves.toMatchObject({
      ip: "unknown",
    });
  });
});

describe("assertSameOrigin", () => {
  it("accepts the configured public origin even behind an internal Host", async () => {
    setHeaders({
      origin: "https://edubridge.example",
      host: "10.0.0.5:3000",
    });

    await expect(assertSameOrigin()).resolves.toBeUndefined();
  });

  it("accepts a matching browser Host header for local development", async () => {
    mocks.appUrl.value = "http://localhost:3000";
    setHeaders({ origin: "http://localhost:3000", host: "localhost:3000" });

    await expect(assertSameOrigin()).resolves.toBeUndefined();
  });

  it("rejects a cross-site origin even if x-forwarded-host is forged", async () => {
    setHeaders({
      origin: "https://attacker.example",
      host: "edubridge.example",
      "x-forwarded-host": "attacker.example",
    });

    await expect(assertSameOrigin()).rejects.toThrow(
      "Cross-origin request rejected.",
    );
  });

  it("rejects an HTTP origin for an HTTPS-configured deployment", async () => {
    setHeaders({
      origin: "http://edubridge.example",
      host: "edubridge.example",
    });

    await expect(assertSameOrigin()).rejects.toThrow(
      "Cross-origin request rejected.",
    );
  });

  it("rejects a malformed origin and tolerates a missing one", async () => {
    setHeaders({ origin: "not a url", host: "edubridge.example" });
    await expect(assertSameOrigin()).rejects.toThrow("Invalid request origin.");

    setHeaders({ host: "edubridge.example" });
    // Next.js performs its own Server Action origin check; this helper only
    // adds an explicit rejection when an Origin header is actually present.
    await expect(assertSameOrigin()).resolves.toBeUndefined();
  });
});
