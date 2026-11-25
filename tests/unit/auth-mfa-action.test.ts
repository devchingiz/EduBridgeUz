import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  assertSameOrigin: vi.fn(),
  checkRateLimits: vi.fn(),
  clearMfaChallengeCookie: vi.fn(),
  completeMfaLogin: vi.fn(),
  enforceRateLimits: vi.fn(),
  getMfaChallengeCookie: vi.fn(),
  getRequestContext: vi.fn(),
  hasClientIp: vi.fn(),
  redirect: vi.fn(),
  setMfaChallengeCookie: vi.fn(),
  setSessionCookie: vi.fn(),
  verifyMfaChallenge: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

vi.mock("@/lib/auth/service", () => ({
  authenticate: mocks.authenticate,
  completeMfaLogin: mocks.completeMfaLogin,
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
vi.mock("@/lib/auth/mfa", () => ({
  verifyMfaChallenge: mocks.verifyMfaChallenge,
}));
vi.mock("@/lib/auth/mfa-challenge-cookie", () => ({
  getMfaChallengeCookie: mocks.getMfaChallengeCookie,
  setMfaChallengeCookie: mocks.setMfaChallengeCookie,
  clearMfaChallengeCookie: mocks.clearMfaChallengeCookie,
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
vi.mock("@/lib/security/password", () => ({
  enforcePasswordPolicy: vi.fn().mockResolvedValue({ ok: true }),
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

import { loginAction, verifyMfaAction } from "@/app/(auth)/actions";
import { initialFormState } from "@/lib/actions/state";
import { AUTH_RATE_LIMITS } from "@/lib/auth/rate-limits";

function credentialsForm(): FormData {
  const form = new FormData();
  form.set("email", "student@example.com");
  form.set("password", "correct-horse-battery-staple");
  return form;
}

function codeForm(code = "123456"): FormData {
  const form = new FormData();
  form.set("code", code);
  return form;
}

const CHALLENGE = "single-use-mfa-challenge-token";
const USER_ID = "user-1";
const VERIFIED = new Date("2026-01-01T00:00:00.000Z");
const CREATED = new Date("2025-12-01T00:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.assertSameOrigin.mockResolvedValue(undefined);
  mocks.checkRateLimits.mockResolvedValue(null);
  mocks.enforceRateLimits.mockResolvedValue(null);
  mocks.getRequestContext.mockResolvedValue({
    ip: "198.51.100.1",
    userAgent: "test",
  });
  mocks.hasClientIp.mockImplementation((ip: string | null | undefined) =>
    Boolean(ip && ip !== "unknown"),
  );
  mocks.redirect.mockImplementation(() => {
    throw new Error("NEXT_REDIRECT");
  });
  mocks.getMfaChallengeCookie.mockResolvedValue(CHALLENGE);
  mocks.verifyMfaChallenge.mockResolvedValue({
    ok: true,
    userId: USER_ID,
    method: "totp",
  });
  mocks.completeMfaLogin.mockResolvedValue({
    sessionToken: "new-session-token",
    emailVerifiedAt: VERIFIED,
    createdAt: CREATED,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("MFA Server Actions", () => {
  it("stores the challenge in a cookie and redirects to /mfa without a session", async () => {
    mocks.authenticate.mockResolvedValue({
      ok: true,
      mfaRequired: true,
      mfaChallengeToken: CHALLENGE,
      userId: USER_ID,
      emailVerifiedAt: VERIFIED,
      createdAt: CREATED,
    });

    await expect(
      loginAction(initialFormState, credentialsForm()),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.setMfaChallengeCookie).toHaveBeenCalledWith(CHALLENGE);
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith("/mfa");
  });

  it("checks hashed challenge and IP limits before verifying a code", async () => {
    await expect(verifyMfaAction(initialFormState, codeForm())).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(mocks.checkRateLimits).toHaveBeenCalledWith([
      expect.objectContaining({
        scope: AUTH_RATE_LIMITS.mfaVerifyIp.scope,
        identifier: "198.51.100.1",
      }),
      expect.objectContaining({
        scope: AUTH_RATE_LIMITS.mfaVerifyChallenge.scope,
      }),
    ]);
    const challengeLimit = mocks.checkRateLimits.mock.calls[0][0][1];
    expect(challengeLimit.identifier).toHaveLength(64);
    expect(challengeLimit.identifier).not.toContain(CHALLENGE);

    expect(mocks.verifyMfaChallenge).toHaveBeenCalledWith(
      CHALLENGE,
      "123456",
      "198.51.100.1",
    );
    expect(mocks.clearMfaChallengeCookie).toHaveBeenCalledOnce();
    expect(mocks.setSessionCookie).toHaveBeenCalledWith("new-session-token");
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("does not create a session when the code is invalid", async () => {
    mocks.verifyMfaChallenge.mockResolvedValue({
      ok: false,
      reason: "invalid_code",
    });

    const result = await verifyMfaAction(initialFormState, codeForm("000000"));

    expect(result.status).toBe("error");
    expect(mocks.enforceRateLimits).toHaveBeenCalled();
    expect(mocks.completeMfaLogin).not.toHaveBeenCalled();
    expect(mocks.clearMfaChallengeCookie).not.toHaveBeenCalled();
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
  });

  it("rejects an expired challenge without attempting verification", async () => {
    mocks.getMfaChallengeCookie.mockResolvedValue(null);

    const result = await verifyMfaAction(initialFormState, codeForm());

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/expired/i);
    expect(mocks.verifyMfaChallenge).not.toHaveBeenCalled();
  });

  it("enforces rate limits before verifying a code", async () => {
    mocks.checkRateLimits.mockResolvedValue({ retryAfterSeconds: 600 });

    const result = await verifyMfaAction(initialFormState, codeForm());

    expect(result.status).toBe("error");
    expect(result.message).toMatch(/too many attempts/i);
    expect(mocks.verifyMfaChallenge).not.toHaveBeenCalled();
  });

  it("rejects a malformed code before touching the challenge counter", async () => {
    const result = await verifyMfaAction(initialFormState, codeForm("bad"));

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.code).toBeTruthy();
    expect(mocks.checkRateLimits).not.toHaveBeenCalled();
    expect(mocks.verifyMfaChallenge).not.toHaveBeenCalled();
  });
});
