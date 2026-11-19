import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  assertSameOrigin: vi.fn(),
  enforceRateLimits: vi.fn(),
  getRequestContext: vi.fn(),
  oauthAttemptCreate: vi.fn(),
  oauthAttemptDeleteMany: vi.fn(),
}));

vi.mock("@/lib/auth/service", () => ({
  authenticate: mocks.authenticate,
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
  setSessionCookie: vi.fn(),
}));
vi.mock("@/lib/http/request", () => ({
  assertSameOrigin: mocks.assertSameOrigin,
  getRequestContext: mocks.getRequestContext,
}));
vi.mock("@/lib/security/rate-limit", () => ({
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.assertSameOrigin.mockResolvedValue(undefined);
  mocks.authenticate.mockResolvedValue({
    ok: false,
    reason: "invalid_credentials",
  });
  mocks.enforceRateLimits.mockResolvedValue(null);
  mocks.getRequestContext.mockResolvedValue({
    ip: "198.51.100.1",
    userAgent: "test",
  });
  mocks.oauthAttemptCreate.mockResolvedValue({});
  mocks.oauthAttemptDeleteMany.mockResolvedValue({ count: 0 });
});

describe("sign-in throttling", () => {
  it("authenticates email/password credentials without applying rate limits", async () => {
    const formData = new FormData();
    formData.set("email", "student@example.com");
    formData.set("password", "correct-horse-battery-staple");

    const result = await loginAction(initialFormState, formData);

    expect(result.status).toBe("error");
    expect(mocks.authenticate).toHaveBeenCalledOnce();
    expect(mocks.enforceRateLimits).not.toHaveBeenCalled();
  });

  it("starts Google sign-in without applying rate limits", async () => {
    const response = await googleSignInStart(
      new Request("http://localhost:3000/api/auth/google/start"),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(mocks.oauthAttemptCreate).toHaveBeenCalledOnce();
    expect(mocks.getRequestContext).not.toHaveBeenCalled();
    expect(mocks.enforceRateLimits).not.toHaveBeenCalled();
  });
});
