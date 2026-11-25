import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertSameOrigin: vi.fn(),
  getRequestContext: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPasswordWithToken: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

vi.mock("@/lib/http/request", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/http/request")>();
  return {
    ...actual,
    assertSameOrigin: mocks.assertSameOrigin,
    getRequestContext: mocks.getRequestContext,
  };
});

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

import {
  forgotPasswordAction,
  resetPasswordAction,
} from "@/app/(auth)/actions";
import { initialFormState } from "@/lib/actions/state";
import { AUTH_RATE_LIMITS } from "@/lib/auth/rate-limits";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/security/crypto";
import { rateLimitKey } from "@/lib/security/rate-limit";

const UNKNOWN_IP = "unknown";
const VALID_IP = "2001:db8::1234";

function forgotForm(email: string): FormData {
  const form = new FormData();
  form.set("email", email);
  return form;
}

function resetForm(token: string): FormData {
  const form = new FormData();
  form.set("token", token);
  form.set("password", "Correct-Horse-Battery-9");
  form.set("confirmPassword", "Correct-Horse-Battery-9");
  return form;
}

function uniqueEmail(): string {
  return `recovery-${randomUUID()}@example.com`;
}

function uniqueToken(): string {
  return `reset-token-${randomUUID()}`;
}

async function findCounter(scope: string, identifier: string) {
  return db.rateLimitCounter.findUnique({
    where: { key: rateLimitKey(scope, identifier) },
    select: { count: true },
  });
}

beforeEach(async () => {
  await db.rateLimitCounter.deleteMany();
  vi.clearAllMocks();
  mocks.assertSameOrigin.mockResolvedValue(undefined);
  mocks.redirect.mockReturnValue(undefined);
  mocks.requestPasswordReset.mockResolvedValue({ token: null });
  mocks.resetPasswordWithToken.mockResolvedValue({
    ok: true,
    name: "Amina Karimova",
    email: "amina@example.com",
  });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("recovery rate-limit counter rows", () => {
  it.each([UNKNOWN_IP, "attacker-1", "  "])(
    "creates no forgot-password IP counter for unusable IP %j",
    async (ip) => {
      const email = uniqueEmail();
      mocks.getRequestContext.mockResolvedValue({ ip, userAgent: "test" });

      await forgotPasswordAction(initialFormState, forgotForm(email));

      await expect(
        findCounter(AUTH_RATE_LIMITS.forgotIp.scope, ip),
      ).resolves.toBeNull();
      await expect(
        findCounter(AUTH_RATE_LIMITS.forgotEmail.scope, email),
      ).resolves.toEqual({ count: 1 });
    },
  );

  it.each([UNKNOWN_IP, "attacker-1", "  "])(
    "creates no reset-password IP counter for unusable IP %j",
    async (ip) => {
      const token = uniqueToken();
      mocks.getRequestContext.mockResolvedValue({ ip, userAgent: "test" });

      await resetPasswordAction(initialFormState, resetForm(token));

      await expect(
        findCounter(AUTH_RATE_LIMITS.resetIp.scope, ip),
      ).resolves.toBeNull();
      await expect(
        findCounter(AUTH_RATE_LIMITS.resetToken.scope, hashToken(token)),
      ).resolves.toEqual({ count: 1 });
    },
  );

  it("creates both forgot-password counters for a valid IP", async () => {
    const email = uniqueEmail();
    mocks.getRequestContext.mockResolvedValue({
      ip: VALID_IP,
      userAgent: "test",
    });

    await forgotPasswordAction(initialFormState, forgotForm(email));

    await expect(
      findCounter(AUTH_RATE_LIMITS.forgotIp.scope, VALID_IP),
    ).resolves.toEqual({ count: 1 });
    await expect(
      findCounter(AUTH_RATE_LIMITS.forgotEmail.scope, email),
    ).resolves.toEqual({ count: 1 });
  });

  it("creates both reset-password counters for a valid IP", async () => {
    const token = uniqueToken();
    mocks.getRequestContext.mockResolvedValue({
      ip: VALID_IP,
      userAgent: "test",
    });

    await resetPasswordAction(initialFormState, resetForm(token));

    await expect(
      findCounter(AUTH_RATE_LIMITS.resetIp.scope, VALID_IP),
    ).resolves.toEqual({ count: 1 });
    await expect(
      findCounter(AUTH_RATE_LIMITS.resetToken.scope, hashToken(token)),
    ).resolves.toEqual({ count: 1 });
  });

  it("still denies excessive forgot requests when the IP is unknown", async () => {
    const email = uniqueEmail();
    mocks.getRequestContext.mockResolvedValue({
      ip: UNKNOWN_IP,
      userAgent: "test",
    });

    const results = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      results.push(
        await forgotPasswordAction(initialFormState, forgotForm(email)),
      );
    }

    expect(
      results.slice(0, 5).every((result) => result?.status === "success"),
    ).toBe(true);
    expect(results[5]?.status).toBe("error");
    expect(results[5]?.message).toContain("Too many attempts");
    expect(mocks.requestPasswordReset).toHaveBeenCalledTimes(5);
    await expect(
      findCounter(AUTH_RATE_LIMITS.forgotIp.scope, UNKNOWN_IP),
    ).resolves.toBeNull();
    await expect(
      findCounter(AUTH_RATE_LIMITS.forgotEmail.scope, email),
    ).resolves.toEqual({ count: 6 });
  });

  it("still denies excessive reset attempts when the IP is unknown", async () => {
    const token = uniqueToken();
    mocks.getRequestContext.mockResolvedValue({
      ip: UNKNOWN_IP,
      userAgent: "test",
    });

    const results = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      results.push(
        await resetPasswordAction(initialFormState, resetForm(token)),
      );
    }

    expect(
      results.slice(0, 5).every((result) => result?.status === undefined),
    ).toBe(true);
    expect(results[5]?.status).toBe("error");
    expect(results[5]?.message).toContain("Too many attempts");
    expect(mocks.resetPasswordWithToken).toHaveBeenCalledTimes(5);
    await expect(
      findCounter(AUTH_RATE_LIMITS.resetIp.scope, UNKNOWN_IP),
    ).resolves.toBeNull();
    await expect(
      findCounter(AUTH_RATE_LIMITS.resetToken.scope, hashToken(token)),
    ).resolves.toEqual({ count: 6 });
  });
});
