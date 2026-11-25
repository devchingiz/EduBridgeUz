import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TOKEN = "verification-token-long-enough-for-schema-123";

const mocks = vi.hoisted(() => ({
  assertSameOrigin: vi.fn(),
  checkPassword: vi.fn(),
  checkRateLimits: vi.fn(),
  enforceRateLimits: vi.fn(),
  getCurrentUser: vi.fn(),
  getRequestContext: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  resendVerificationEmail: vi.fn(),
  verifyEmailToken: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

vi.mock("@/lib/auth/service", () => ({
  authenticate: vi.fn(),
  completeMfaLogin: vi.fn(),
  recordGuardianDecision: vi.fn(),
  registerAccount: vi.fn(),
  requestPasswordReset: vi.fn(),
  resendVerificationEmail: mocks.resendVerificationEmail,
  resetPasswordWithToken: vi.fn(),
  verifyEmailToken: mocks.verifyEmailToken,
}));

vi.mock("@/lib/auth/dal", () => ({ getCurrentUser: mocks.getCurrentUser }));
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
  resendVerificationAction,
  verifyEmailAction,
} from "@/app/(auth)/actions";
import { initialFormState } from "@/lib/actions/state";

function verificationForm(token: string): FormData {
  const form = new FormData();
  form.set("token", token);
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.assertSameOrigin.mockResolvedValue(undefined);
  mocks.enforceRateLimits.mockResolvedValue(null);
  mocks.getRequestContext.mockResolvedValue({
    ip: "198.51.100.1",
    userAgent: "test",
  });
  mocks.getCurrentUser.mockResolvedValue({
    id: "user-1",
    email: "amina@example.com",
    name: "Amina Karimova",
    role: "STUDENT",
    emailVerifiedAt: null,
    dateOfBirth: new Date("2000-05-10T00:00:00.000Z"),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  });
  mocks.redirect.mockReturnValue(undefined);
  mocks.revalidatePath.mockReturnValue(undefined);
  mocks.resendVerificationEmail.mockResolvedValue({
    ok: true,
    alreadyVerified: false,
  });
  mocks.verifyEmailToken.mockResolvedValue({
    ok: true,
    userId: "user-1",
    name: "Amina Karimova",
    email: "amina@example.com",
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("verification action", () => {
  it("consumes the hidden-token POST payload without logging the token", async () => {
    const spies = [
      vi.spyOn(console, "log").mockImplementation(() => {}),
      vi.spyOn(console, "info").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
      vi.spyOn(console, "error").mockImplementation(() => {}),
    ];

    await verifyEmailAction(initialFormState, verificationForm(TOKEN));

    expect(mocks.verifyEmailToken).toHaveBeenCalledWith(
      TOKEN,
      expect.objectContaining({ ip: "198.51.100.1" }),
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/login?verified=1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard", "layout");
    const output = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    expect(output).not.toContain(TOKEN);
  });

  it("returns a generic message for a malformed token", async () => {
    const result = await verifyEmailAction(
      initialFormState,
      verificationForm("short"),
    );

    expect(result.status).toBe("error");
    expect(result.message).toBe(
      "This verification link is invalid or has expired.",
    );
    expect(JSON.stringify(result)).not.toContain("short");
    expect(mocks.verifyEmailToken).not.toHaveBeenCalled();
  });

  it("returns a generic message when the token cannot be consumed", async () => {
    mocks.verifyEmailToken.mockResolvedValueOnce({ ok: false });

    const result = await verifyEmailAction(
      initialFormState,
      verificationForm(TOKEN),
    );

    expect(result.status).toBe("error");
    expect(result.message).toContain("invalid or has expired");
    expect(JSON.stringify(result)).not.toContain(TOKEN);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("does not consume a token when rate limited", async () => {
    mocks.enforceRateLimits.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 600,
      limit: 5,
    });

    const result = await verifyEmailAction(
      initialFormState,
      verificationForm(TOKEN),
    );

    expect(result.status).toBe("error");
    expect(result.message).toContain("Try again");
    expect(JSON.stringify(result)).not.toContain(TOKEN);
    expect(mocks.enforceRateLimits).toHaveBeenCalledWith([
      expect.objectContaining({ scope: "auth.resend.ip" }),
    ]);
    expect(mocks.verifyEmailToken).not.toHaveBeenCalled();
  });
});

describe("resend verification action", () => {
  it("sends a new link for the signed-in user", async () => {
    const result = await resendVerificationAction(initialFormState);

    expect(mocks.enforceRateLimits).toHaveBeenCalledWith([
      expect.objectContaining({
        scope: "auth.resend.ip",
        identifier: "198.51.100.1",
      }),
      expect.objectContaining({
        scope: "auth.resend.user",
        identifier: "user-1",
      }),
    ]);
    expect(mocks.resendVerificationEmail).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ ip: "198.51.100.1" }),
    );
    expect(result.status).toBe("success");
    expect(result.message).toContain("Check your inbox");
  });

  it("shows a cooldown message without sending when rate limited", async () => {
    mocks.enforceRateLimits.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 600,
      limit: 10,
    });

    const result = await resendVerificationAction(initialFormState);

    expect(result.status).toBe("error");
    expect(result.message).toContain("Try again in 10 minutes");
    expect(mocks.resendVerificationEmail).not.toHaveBeenCalled();
  });

  it("refreshes the dashboard when the account is already verified", async () => {
    mocks.resendVerificationEmail.mockResolvedValueOnce({
      ok: true,
      alreadyVerified: true,
    });

    const result = await resendVerificationAction(initialFormState);

    expect(result.status).toBe("success");
    expect(result.message).toBe("Your email is already verified.");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard", "layout");
  });

  it("requires a signed-in user", async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(null);

    const result = await resendVerificationAction(initialFormState);

    expect(result.status).toBe("error");
    expect(result.message).toBe("Sign in to request a new verification link.");
    expect(mocks.resendVerificationEmail).not.toHaveBeenCalled();
  });
});
