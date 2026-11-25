import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  assertSameOrigin: vi.fn(),
  checkRateLimits: vi.fn(),
  enforceRateLimits: vi.fn(),
  getRequestContext: vi.fn(),
  hasClientIp: vi.fn(),
  oauthAttemptCreate: vi.fn(),
  oauthAttemptDeleteMany: vi.fn(),
  redirect: vi.fn(),
  setSessionCookie: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

vi.mock("@/lib/auth/service", () => ({
  authenticate: mocks.authenticate,
  completeMfaLogin: vi.fn(),
  recordGuardianDecision: vi.fn(),
  registerAccount: vi.fn(),
  requestPasswordReset: vi.fn(),
  resendVerificationEmail: vi.fn(),
  resetPasswordWithToken: vi.fn(),
  verifyEmailToken: vi.fn(),
}));

vi.mock("@/lib/auth/dal", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  destroyCurrentSession: vi.fn(),
  setSessionCookie: mocks.setSessionCookie,
}));
vi.mock("@/lib/http/request", () => ({
  assertSameOrigin: mocks.assertSameOrigin,
  getRequestContext: mocks.getRequestContext,
  hasClientIp: mocks.hasClientIp,
}));
vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimits: mocks.checkRateLimits,
  enforceRateLimits: mocks.enforceRateLimits,
}));
vi.mock("@/lib/db", () => ({
  db: {
    googleOAuthAttempt: {
      create: mocks.oauthAttemptCreate,
      deleteMany: mocks.oauthAttemptDeleteMany,
    },
  },
}));
vi.mock("@/lib/env", () => ({
  getAppUrl: () => "http://localhost:3000",
  getVerificationEnforcementStart: () => new Date("2026-01-01T00:00:00.000Z"),
  getGoogleOAuthConfig: () => ({
    callbackUrl: "http://localhost:3000/api/auth/google/callback",
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
  }),
  isProduction: () => false,
}));
vi.mock("@/lib/observability/logger", () => ({ logError: vi.fn() }));

import { loginAction } from "@/app/(auth)/actions";
import { GET as googleSignInStart } from "@/app/api/auth/google/start/route";
import { initialFormState } from "@/lib/actions/state";
import { AUTH_RATE_LIMITS } from "@/lib/auth/rate-limits";

function credentialsForm(overrides: Record<string, string> = {}): FormData {
  const form = new FormData();
  form.set("email", "student@example.com");
  form.set("password", "correct-horse-battery-staple");
  for (const [key, value] of Object.entries(overrides)) form.set(key, value);
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.assertSameOrigin.mockResolvedValue(undefined);
  mocks.authenticate.mockResolvedValue({
    ok: false,
    reason: "invalid_credentials",
  });
  mocks.checkRateLimits.mockResolvedValue(null);
  mocks.enforceRateLimits.mockResolvedValue(null);
  mocks.getRequestContext.mockResolvedValue({
    ip: "198.51.100.1",
    userAgent: "test",
  });
  mocks.hasClientIp.mockImplementation((ip: string | null | undefined) =>
    Boolean(ip && ip !== "unknown"),
  );
  mocks.oauthAttemptCreate.mockResolvedValue({});
  mocks.oauthAttemptDeleteMany.mockResolvedValue({ count: 0 });
  mocks.redirect.mockImplementation((path: string) => {
    if (path === "/verify-email") {
      throw new Error("NEXT_REDIRECT");
    }
    return undefined;
  });
  mocks.setSessionCookie.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("sign-in throttling", () => {
  it("counts a failed credential check against hashed email and IP scopes", async () => {
    const result = await loginAction(initialFormState, credentialsForm());

    expect(result).toEqual({
      status: "error",
      message: "Email or password is incorrect.",
      fieldErrors: undefined,
    });
    expect(mocks.authenticate).toHaveBeenCalledOnce();
    expect(mocks.checkRateLimits).toHaveBeenCalledWith([
      expect.objectContaining(AUTH_RATE_LIMITS.signInIp),
      expect.objectContaining(AUTH_RATE_LIMITS.signInEmail),
    ]);
    expect(mocks.enforceRateLimits).toHaveBeenCalledWith([
      expect.objectContaining({
        ...AUTH_RATE_LIMITS.signInIp,
        identifier: "198.51.100.1",
      }),
      expect.objectContaining({
        ...AUTH_RATE_LIMITS.signInEmail,
        identifier: "student@example.com",
      }),
    ]);
  });

  it("stops verifying passwords once a counter is exhausted", async () => {
    mocks.checkRateLimits.mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 120,
      limit: AUTH_RATE_LIMITS.signInEmail.limit,
    });

    const result = await loginAction(initialFormState, credentialsForm());

    expect(result).toEqual({
      status: "error",
      message: "Too many attempts. Try again in 2 minutes.",
      fieldErrors: undefined,
    });
    expect(mocks.authenticate).not.toHaveBeenCalled();
    expect(mocks.enforceRateLimits).not.toHaveBeenCalled();
  });

  it("does not consume an attempt when the credentials are correct", async () => {
    mocks.authenticate.mockResolvedValue({
      ok: true,
      sessionToken: "session-token",
      userId: "user-1",
      emailVerifiedAt: new Date("2026-01-02T00:00:00.000Z"),
      createdAt: new Date("2025-12-01T00:00:00.000Z"),
    });

    await loginAction(initialFormState, credentialsForm());

    expect(mocks.checkRateLimits).toHaveBeenCalledOnce();
    expect(mocks.enforceRateLimits).not.toHaveBeenCalled();
    expect(mocks.setSessionCookie).toHaveBeenCalledWith("session-token");
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("redirects a newly registered unverified user to email verification", async () => {
    mocks.authenticate.mockResolvedValue({
      ok: true,
      sessionToken: "session-token",
      userId: "user-1",
      emailVerifiedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await expect(
      loginAction(initialFormState, credentialsForm()),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.setSessionCookie).toHaveBeenCalledWith("session-token");
    expect(mocks.redirect).toHaveBeenCalledWith("/verify-email");
    expect(mocks.redirect).not.toHaveBeenCalledWith("/dashboard");
  });

  it("allows a legacy unverified user inside the fixed grace window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T00:00:00.000Z"));
    mocks.authenticate.mockResolvedValue({
      ok: true,
      sessionToken: "session-token",
      userId: "user-1",
      emailVerifiedAt: null,
      createdAt: new Date("2025-12-15T00:00:00.000Z"),
    });

    await loginAction(initialFormState, credentialsForm());

    expect(mocks.setSessionCookie).toHaveBeenCalledWith("session-token");
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard");
    expect(mocks.redirect).not.toHaveBeenCalledWith("/verify-email");
  });

  it("blocks a legacy unverified user after the fixed grace window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-01T00:00:00.000Z"));
    mocks.authenticate.mockResolvedValue({
      ok: true,
      sessionToken: "session-token",
      userId: "user-1",
      emailVerifiedAt: null,
      createdAt: new Date("2025-12-15T00:00:00.000Z"),
    });

    await expect(
      loginAction(initialFormState, credentialsForm()),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.setSessionCookie).toHaveBeenCalledWith("session-token");
    expect(mocks.redirect).toHaveBeenCalledWith("/verify-email");
    expect(mocks.redirect).not.toHaveBeenCalledWith("/dashboard");
  });

  it("never uses the shared unknown-IP sentinel as a counter key", async () => {
    mocks.getRequestContext.mockResolvedValue({
      ip: "unknown",
      userAgent: "test",
    });

    await loginAction(initialFormState, credentialsForm());

    expect(mocks.hasClientIp).toHaveBeenCalledWith("unknown");
    expect(mocks.checkRateLimits).toHaveBeenCalledWith([
      expect.objectContaining({
        ...AUTH_RATE_LIMITS.signInEmail,
        identifier: "student@example.com",
      }),
    ]);
  });

  it("does not touch sign-in counters for invalid form input", async () => {
    const result = await loginAction(
      initialFormState,
      credentialsForm({ email: "not-an-email" }),
    );

    expect(result.status).toBe("error");
    expect(mocks.checkRateLimits).not.toHaveBeenCalled();
    expect(mocks.enforceRateLimits).not.toHaveBeenCalled();
    expect(mocks.authenticate).not.toHaveBeenCalled();
  });

  it("starts Google sign-in without password counters", async () => {
    const response = await googleSignInStart(
      new Request("http://localhost:3000/api/auth/google/start"),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(mocks.oauthAttemptCreate).toHaveBeenCalledOnce();
    expect(mocks.getRequestContext).not.toHaveBeenCalled();
    expect(mocks.checkRateLimits).not.toHaveBeenCalled();
    expect(mocks.enforceRateLimits).not.toHaveBeenCalled();
  });
});
