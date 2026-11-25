import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ redirect: vi.fn() }));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import {
  EMAIL_VERIFICATION_REDIRECT,
  VERIFICATION_GRACE_DAYS,
  getVerificationRequirement,
  requireEmailVerification,
  verificationGraceDeadline,
} from "@/lib/auth/verification-policy";

const START = new Date("2026-01-01T00:00:00.000Z");
const DEADLINE = new Date("2026-01-31T00:00:00.000Z");

const legacyUnverified = {
  emailVerifiedAt: null,
  createdAt: new Date("2025-12-15T00:00:00.000Z"),
};

const newUnverified = {
  emailVerifiedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv(
    "EMAIL_VERIFICATION_ENFORCEMENT_START",
    "2026-01-01T00:00:00.000Z",
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("email verification policy", () => {
  it("uses the configured start plus a fixed 30-day deadline", () => {
    expect(VERIFICATION_GRACE_DAYS).toBe(30);
    expect(verificationGraceDeadline(START)).toEqual(DEADLINE);
  });

  it("allows a verified account regardless of creation date", () => {
    const verified = {
      ...newUnverified,
      emailVerifiedAt: new Date("2026-01-02T00:00:00.000Z"),
    };

    expect(
      getVerificationRequirement(
        verified,
        new Date("2026-02-01T00:00:00.000Z"),
      ),
    ).toEqual({
      state: "verified",
    });
  });

  it("requires verification for a newly registered unverified account", () => {
    expect(
      getVerificationRequirement(
        newUnverified,
        new Date("2026-01-02T00:00:00.000Z"),
      ),
    ).toEqual({ state: "required", reason: "new_account" });
  });

  it("keeps a legacy unverified account inside the grace window", () => {
    expect(
      getVerificationRequirement(
        legacyUnverified,
        new Date("2026-01-30T23:59:59.000Z"),
      ),
    ).toEqual({
      state: "grace",
      deadline: DEADLINE,
    });
  });

  it("blocks a legacy unverified account after the grace window", () => {
    expect(
      getVerificationRequirement(
        legacyUnverified,
        new Date("2026-02-01T00:00:00.000Z"),
      ),
    ).toEqual({ state: "required", reason: "grace_expired" });
  });

  it("does not roll the deadline forward with the current time", () => {
    const early = getVerificationRequirement(
      legacyUnverified,
      new Date("2026-01-10T00:00:00.000Z"),
    );
    const late = getVerificationRequirement(
      legacyUnverified,
      new Date("2026-01-25T00:00:00.000Z"),
    );

    expect(early).toEqual({ state: "grace", deadline: DEADLINE });
    expect(late).toEqual({ state: "grace", deadline: DEADLINE });
  });

  it("redirects direct dashboard access for a new unverified account", () => {
    requireEmailVerification(
      newUnverified,
      new Date("2026-01-02T00:00:00.000Z"),
    );

    expect(mocks.redirect).toHaveBeenCalledWith(EMAIL_VERIFICATION_REDIRECT);
    expect(mocks.redirect).toHaveBeenCalledTimes(1);
  });

  it("does not redirect an existing legacy session inside grace", () => {
    requireEmailVerification(
      legacyUnverified,
      new Date("2026-01-15T00:00:00.000Z"),
    );

    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("fails closed when the rollout timestamp is missing", () => {
    vi.stubEnv("EMAIL_VERIFICATION_ENFORCEMENT_START", "");

    expect(getVerificationRequirement(legacyUnverified)).toEqual({
      state: "required",
      reason: "configuration_invalid",
    });
    requireEmailVerification(legacyUnverified);
    expect(mocks.redirect).toHaveBeenCalledWith(EMAIL_VERIFICATION_REDIRECT);
  });

  it("fails closed when the rollout timestamp is malformed", () => {
    vi.stubEnv("EMAIL_VERIFICATION_ENFORCEMENT_START", "not-a-date");

    expect(getVerificationRequirement(legacyUnverified)).toEqual({
      state: "required",
      reason: "configuration_invalid",
    });
  });
});
