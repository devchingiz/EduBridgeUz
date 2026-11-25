import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const IP = "198.51.100.1";
const TOKEN = "reset-token-long-enough-for-schema-123";
const PASSWORD = "Correct-Horse-Battery-9";
const GENERIC_FORGOT_MESSAGE =
  "If an account exists for that email, we sent a reset link. Check your inbox and spam folder.";

const mocks = vi.hoisted(() => ({
  assertSameOrigin: vi.fn(),
  checkPassword: vi.fn(),
  checkRateLimits: vi.fn(),
  enforceRateLimits: vi.fn(),
  getRequestContext: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPasswordWithToken: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

vi.mock("@/lib/auth/service", () => ({
  authenticate: vi.fn(),
  completeMfaLogin: vi.fn(),
  recordGuardianDecision: vi.fn(),
  registerAccount: vi.fn(),
  requestPasswordReset: mocks.requestPasswordReset,
  resendVerificationEmail: vi.fn(),
  resetPasswordWithToken: mocks.resetPasswordWithToken,
  verifyEmailToken: vi.fn(),
}));

vi.mock("@/lib/auth/dal", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  destroyCurrentSession: vi.fn(),
  setSessionCookie: vi.fn(),
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
}));

import {
  forgotPasswordAction,
  resetPasswordAction,
} from "@/app/(auth)/actions";
import { initialFormState } from "@/lib/actions/state";
import { hashToken } from "@/lib/security/crypto";

function forgotForm(email: string): FormData {
  const form = new FormData();
  form.set("email", email);
  return form;
}

function resetForm(
  overrides: Partial<
    Record<"token" | "password" | "confirmPassword", string>
  > = {},
): FormData {
  const values = {
    token: TOKEN,
    password: PASSWORD,
    confirmPassword: PASSWORD,
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
  mocks.enforceRateLimits.mockResolvedValue(null);
  mocks.getRequestContext.mockResolvedValue({ ip: IP, userAgent: "test" });
  mocks.redirect.mockReturnValue(undefined);
  mocks.revalidatePath.mockReturnValue(undefined);
  mocks.requestPasswordReset.mockResolvedValue({ token: null });
  mocks.resetPasswordWithToken.mockResolvedValue({
    ok: true,
    name: "Amina Karimova",
    email: "amina@example.com",
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("forgotPasswordAction", () => {
  it("returns the same public response for known and unknown addresses", async () => {
    const spies = [
      vi.spyOn(console, "log").mockImplementation(() => {}),
      vi.spyOn(console, "info").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
      vi.spyOn(console, "error").mockImplementation(() => {}),
    ];

    mocks.requestPasswordReset.mockResolvedValueOnce({
      token: "known-account-token",
    });
    const known = await forgotPasswordAction(
      initialFormState,
      forgotForm("amina@example.com"),
    );

    mocks.requestPasswordReset.mockResolvedValueOnce({ token: null });
    const unknown = await forgotPasswordAction(
      initialFormState,
      forgotForm("nobody@example.com"),
    );

    expect(known).toEqual(unknown);
    expect(known).toEqual({
      status: "success",
      message: GENERIC_FORGOT_MESSAGE,
    });
    expect(mocks.requestPasswordReset).toHaveBeenNthCalledWith(
      1,
      "amina@example.com",
      expect.objectContaining({ ip: IP }),
    );
    expect(mocks.requestPasswordReset).toHaveBeenNthCalledWith(
      2,
      "nobody@example.com",
      expect.objectContaining({ ip: IP }),
    );
    expect(mocks.enforceRateLimits).toHaveBeenCalledWith([
      expect.objectContaining({ scope: "auth.forgot.ip", identifier: IP }),
      expect.objectContaining({
        scope: "auth.forgot.email",
        identifier: "amina@example.com",
      }),
    ]);
    expect(
      JSON.stringify(spies.flatMap((spy) => spy.mock.calls)),
    ).not.toContain("known-account-token");
  });

  it("rejects a malformed email before rate limiting or service work", async () => {
    const result = await forgotPasswordAction(
      initialFormState,
      forgotForm("not-an-email"),
    );

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.email).toBeDefined();
    expect(mocks.enforceRateLimits).not.toHaveBeenCalled();
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled();
  });

  it("shows a generic cooldown without calling the service when rate limited", async () => {
    mocks.enforceRateLimits.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 60,
      limit: 5,
    });

    const result = await forgotPasswordAction(
      initialFormState,
      forgotForm("amina@example.com"),
    );

    expect(result.status).toBe("error");
    expect(result.message).toBe("Too many attempts. Try again in 1 minute.");
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled();
  });

  it.each(["unknown", "attacker-1", "", "   "])(
    "skips only the IP counter for unusable client IP %j",
    async (ip) => {
      mocks.getRequestContext.mockResolvedValue({ ip, userAgent: "test" });

      await forgotPasswordAction(
        initialFormState,
        forgotForm("amina@example.com"),
      );

      expect(mocks.enforceRateLimits).toHaveBeenCalledWith([
        expect.objectContaining({
          scope: "auth.forgot.email",
          identifier: "amina@example.com",
        }),
      ]);
      expect(mocks.requestPasswordReset).toHaveBeenCalled();
    },
  );

  it("applies both IP and email limits for a valid IPv6 address", async () => {
    mocks.getRequestContext.mockResolvedValue({
      ip: "2001:db8::1",
      userAgent: "test",
    });

    await forgotPasswordAction(
      initialFormState,
      forgotForm("amina@example.com"),
    );

    expect(mocks.enforceRateLimits).toHaveBeenCalledWith([
      expect.objectContaining({
        scope: "auth.forgot.ip",
        identifier: "2001:db8::1",
      }),
      expect.objectContaining({
        scope: "auth.forgot.email",
        identifier: "amina@example.com",
      }),
    ]);
  });

  it("still enforces the email limit with a generic denial when the IP is unknown", async () => {
    mocks.getRequestContext.mockResolvedValue({
      ip: "unknown",
      userAgent: "test",
    });
    mocks.enforceRateLimits.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 120,
      limit: 5,
    });

    const result = await forgotPasswordAction(
      initialFormState,
      forgotForm("amina@example.com"),
    );

    expect(result).toEqual({
      status: "error",
      message: "Too many attempts. Try again in 2 minutes.",
    });
    expect(mocks.enforceRateLimits).toHaveBeenCalledWith([
      expect.objectContaining({ scope: "auth.forgot.email" }),
    ]);
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled();
  });
});

describe("resetPasswordAction", () => {
  it("passes both password fields to the service and redirects after success", async () => {
    const spies = [
      vi.spyOn(console, "log").mockImplementation(() => {}),
      vi.spyOn(console, "info").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
      vi.spyOn(console, "error").mockImplementation(() => {}),
    ];

    const result = await resetPasswordAction(initialFormState, resetForm());

    expect(mocks.resetPasswordWithToken).toHaveBeenCalledWith(
      TOKEN,
      PASSWORD,
      PASSWORD,
      expect.objectContaining({ ip: IP }),
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/login?reset=1");
    expect(result).toBeUndefined();
    const output = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    expect(output).not.toContain(TOKEN);
    expect(output).not.toContain(PASSWORD);
  });

  it("rejects mismatched confirmation in the action before service work", async () => {
    const result = await resetPasswordAction(
      initialFormState,
      resetForm({ confirmPassword: "Different-Strong-Passphrase-9" }),
    );

    expect(result.status).toBe("error");
    expect(result.fieldErrors?.confirmPassword).toBe("Passwords do not match.");
    expect(mocks.resetPasswordWithToken).not.toHaveBeenCalled();
  });

  it("maps a service-level confirmation mismatch to the confirmation field", async () => {
    mocks.resetPasswordWithToken.mockResolvedValueOnce({
      ok: false,
      reason: "password_mismatch",
    });

    const result = await resetPasswordAction(initialFormState, resetForm());

    expect(mocks.resetPasswordWithToken).toHaveBeenCalledWith(
      TOKEN,
      PASSWORD,
      PASSWORD,
      expect.objectContaining({ ip: IP }),
    );
    expect(result.status).toBe("error");
    expect(result.fieldErrors?.confirmPassword).toBe("Passwords do not match.");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("maps password policy failures to the password field", async () => {
    mocks.resetPasswordWithToken.mockResolvedValueOnce({
      ok: false,
      reason: "password_rejected",
      errors: ["Use a less repetitive password."],
    });

    const result = await resetPasswordAction(initialFormState, resetForm());

    expect(result.status).toBe("error");
    expect(result.message).toBe("Choose a stronger password.");
    expect(result.fieldErrors?.password).toBe(
      "Use a less repetitive password.",
    );
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("returns a generic invalid-link message without leaking the token", async () => {
    mocks.resetPasswordWithToken.mockResolvedValueOnce({
      ok: false,
      reason: "invalid_token",
    });

    const result = await resetPasswordAction(initialFormState, resetForm());

    expect(result.status).toBe("error");
    expect(result.message).toBe(
      "This reset link is invalid or has expired. Request a new one.",
    );
    expect(JSON.stringify(result)).not.toContain(TOKEN);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("applies IP and hashed token throttles without calling the service", async () => {
    mocks.enforceRateLimits.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 600,
      limit: 5,
    });

    const result = await resetPasswordAction(initialFormState, resetForm());

    expect(result.status).toBe("error");
    expect(result.message).toContain("Try again in 10 minutes");
    expect(mocks.enforceRateLimits).toHaveBeenCalledWith([
      expect.objectContaining({ scope: "auth.reset.ip", identifier: IP }),
      expect.objectContaining({
        scope: "auth.reset.token",
        identifier: hashToken(TOKEN),
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain(TOKEN);
    expect(mocks.resetPasswordWithToken).not.toHaveBeenCalled();
  });

  it.each(["unknown", "attacker-1", "", "   "])(
    "skips only the IP counter for unusable client IP %j",
    async (ip) => {
      mocks.getRequestContext.mockResolvedValue({ ip, userAgent: "test" });

      await resetPasswordAction(initialFormState, resetForm());

      const limits = mocks.enforceRateLimits.mock.calls[0][0];
      expect(limits).toHaveLength(1);
      expect(limits[0]).toEqual(
        expect.objectContaining({
          scope: "auth.reset.token",
          identifier: hashToken(TOKEN),
        }),
      );
      expect(limits[0].identifier).not.toBe(TOKEN);
      expect(mocks.resetPasswordWithToken).toHaveBeenCalled();
    },
  );

  it("applies both IP and hashed token limits for a valid IPv6 address", async () => {
    mocks.getRequestContext.mockResolvedValue({
      ip: "2001:db8::1",
      userAgent: "test",
    });

    await resetPasswordAction(initialFormState, resetForm());

    expect(mocks.enforceRateLimits).toHaveBeenCalledWith([
      expect.objectContaining({
        scope: "auth.reset.ip",
        identifier: "2001:db8::1",
      }),
      expect.objectContaining({
        scope: "auth.reset.token",
        identifier: hashToken(TOKEN),
      }),
    ]);
  });

  it("still enforces the token limit with a generic denial when the IP is unknown", async () => {
    mocks.getRequestContext.mockResolvedValue({
      ip: "unknown",
      userAgent: "test",
    });
    mocks.enforceRateLimits.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 120,
      limit: 5,
    });

    const result = await resetPasswordAction(initialFormState, resetForm());

    expect(result).toEqual({
      status: "error",
      message: "Too many attempts. Try again in 2 minutes.",
    });
    expect(mocks.enforceRateLimits).toHaveBeenCalledWith([
      expect.objectContaining({
        scope: "auth.reset.token",
        identifier: hashToken(TOKEN),
      }),
    ]);
    expect(JSON.stringify(result)).not.toContain(TOKEN);
    expect(mocks.resetPasswordWithToken).not.toHaveBeenCalled();
  });
});
