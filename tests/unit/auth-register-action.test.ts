import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertSameOrigin: vi.fn(),
  checkPassword: vi.fn(),
  checkRateLimits: vi.fn(),
  enforcePasswordPolicy: vi.fn(),
  enforceRateLimits: vi.fn(),
  getRequestContext: vi.fn(),
  redirect: vi.fn(),
  registerAccount: vi.fn(),
  setSessionCookie: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

vi.mock("@/lib/auth/service", () => ({
  authenticate: vi.fn(),
  completeMfaLogin: vi.fn(),
  recordGuardianDecision: vi.fn(),
  registerAccount: mocks.registerAccount,
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

vi.mock("@/lib/http/request", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/http/request")>();
  return {
    ...actual,
    assertSameOrigin: mocks.assertSameOrigin,
    getRequestContext: mocks.getRequestContext,
  };
});

vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimits: mocks.checkRateLimits,
  enforceRateLimits: mocks.enforceRateLimits,
}));
vi.mock("@/lib/security/password", () => ({
  checkPassword: mocks.checkPassword,
  enforcePasswordPolicy: mocks.enforcePasswordPolicy,
}));

import { registerAction } from "@/app/(auth)/actions";
import { initialFormState } from "@/lib/actions/state";

function registrationForm(
  overrides: Record<string, string | undefined> = {},
): FormData {
  const values: Record<string, string | undefined> = {
    name: "Amina Karimova",
    email: "amina@example.com",
    password: "Correct-Horse-Battery-9",
    confirmPassword: "Correct-Horse-Battery-9",
    dateOfBirth: "2000-05-10",
    acceptTerms: "on",
    ...overrides,
  };
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) form.set(key, value);
  }
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.assertSameOrigin.mockResolvedValue(undefined);
  mocks.checkPassword.mockReturnValue({ ok: true });
  mocks.enforcePasswordPolicy.mockResolvedValue({ ok: true });
  mocks.enforceRateLimits.mockResolvedValue(null);
  mocks.getRequestContext.mockResolvedValue({
    ip: "198.51.100.1",
    userAgent: "test",
  });
  mocks.redirect.mockReturnValue(undefined);
  mocks.registerAccount.mockResolvedValue({
    ok: true,
    userId: "user-1",
    name: "Amina Karimova",
    email: "amina@example.com",
    sessionToken: "session-token",
    verificationToken: "verification-token",
    guardianToken: null,
    guardianEmail: null,
    minor: false,
  });
  mocks.setSessionCookie.mockResolvedValue(undefined);
});

describe("registration action", () => {
  it("validates before touching the attempt counters", async () => {
    const result = await registerAction(
      initialFormState,
      registrationForm({ name: "", password: "short", acceptTerms: undefined }),
    );

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.name).toBeDefined();
    expect(result.fieldErrors?.password).toBeDefined();
    expect(mocks.enforcePasswordPolicy).not.toHaveBeenCalled();
    expect(mocks.enforceRateLimits).not.toHaveBeenCalled();
    expect(mocks.registerAccount).not.toHaveBeenCalled();
  });

  it("accepts a matching password confirmation", async () => {
    await registerAction(initialFormState, registrationForm());

    expect(mocks.registerAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        password: "Correct-Horse-Battery-9",
        confirmPassword: "Correct-Horse-Battery-9",
      }),
      expect.anything(),
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/verify-email");
  });

  it("rejects a non-matching password confirmation on the server", async () => {
    const result = await registerAction(
      initialFormState,
      registrationForm({ confirmPassword: "Different-Strong-Pass-9" }),
    );

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.confirmPassword).toBe("Passwords do not match.");
    expect(mocks.enforceRateLimits).not.toHaveBeenCalled();
    expect(mocks.registerAccount).not.toHaveBeenCalled();
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
  });

  it("rejects a weak password without consuming an attempt", async () => {
    mocks.enforcePasswordPolicy.mockResolvedValueOnce({
      ok: false,
      errors: ["Do not include your name in your password."],
    });

    const result = await registerAction(initialFormState, registrationForm());

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.password).toContain("your name");
    expect(mocks.enforceRateLimits).not.toHaveBeenCalled();
    expect(mocks.registerAccount).not.toHaveBeenCalled();
  });

  it("does not share a counter when the client IP is unavailable", async () => {
    mocks.getRequestContext.mockResolvedValue({
      ip: "unknown",
      userAgent: null,
    });

    await registerAction(initialFormState, registrationForm());

    expect(mocks.enforceRateLimits).toHaveBeenCalledWith([
      expect.objectContaining({
        scope: "auth.register.v2.email",
        identifier: "amina@example.com",
      }),
    ]);
  });

  it("applies the fresh IP and email limits to a valid submission", async () => {
    await registerAction(initialFormState, registrationForm());

    expect(mocks.enforceRateLimits).toHaveBeenCalledWith([
      expect.objectContaining({
        scope: "auth.register.v2.ip",
        identifier: "198.51.100.1",
      }),
      expect.objectContaining({
        scope: "auth.register.v2.email",
        identifier: "amina@example.com",
      }),
    ]);
    expect(mocks.registerAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Amina Karimova",
        confirmPassword: "Correct-Horse-Battery-9",
      }),
      expect.anything(),
    );
    expect(mocks.setSessionCookie).toHaveBeenCalledWith("session-token");
    expect(mocks.redirect).toHaveBeenCalledWith("/verify-email");
  });

  it("returns the same public redirect for an existing email", async () => {
    mocks.registerAccount.mockResolvedValueOnce({
      ok: false,
      reason: "email_taken",
    });

    const result = await registerAction(initialFormState, registrationForm());

    expect(result).toBeUndefined();
    expect(mocks.redirect).toHaveBeenCalledWith("/verify-email");
    expect(mocks.redirect).toHaveBeenCalledTimes(1);
    expect(mocks.setSessionCookie).not.toHaveBeenCalled();
    expect(mocks.enforceRateLimits).toHaveBeenCalledTimes(1);
  });

  it("shows a retry message when the counter is exhausted", async () => {
    mocks.enforceRateLimits.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 600,
      limit: 10,
    });

    const result = await registerAction(initialFormState, registrationForm());

    expect(result.status).toBe("error");
    expect(result.message).toContain("Try again");
    expect(mocks.registerAccount).not.toHaveBeenCalled();
  });
});
