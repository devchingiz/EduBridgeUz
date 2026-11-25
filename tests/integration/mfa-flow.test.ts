import { randomUUID } from "node:crypto";

import { beforeEach, describe, expect, it } from "vitest";

import {
  registerAccount,
  authenticate,
  completeMfaLogin,
} from "@/lib/auth/service";
import {
  beginMfaEnrollment,
  confirmMfaEnrollment,
  disableMfa,
  getMfaStatus,
  issueMfaChallenge,
  verifyMfaChallenge,
} from "@/lib/auth/mfa";
import { generateTotpCode } from "@/lib/auth/totp";
import { validateSessionToken } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/security/crypto";
import type { RegisterInput } from "@/lib/validation/auth";

const PASSWORD = "Correct-Horse-Battery-9";

async function registerAdult(): Promise<string> {
  const email = `mfa-${randomUUID()}@example.com`;
  const input: RegisterInput = {
    name: "MFA Test Student",
    email,
    password: PASSWORD,
    confirmPassword: PASSWORD,
    dateOfBirth: "2002-05-12",
    guardianName: "",
    guardianEmail: "",
    acceptTerms: true,
  };
  const result = await registerAccount(input);
  if (!result.ok) throw new Error(`registration failed: ${result.reason}`);
  return result.userId;
}

async function enroll(userId: string) {
  const enrollment = await beginMfaEnrollment(userId);
  if (!enrollment) throw new Error("enrollment failed");
  const code = generateTotpCode(enrollment.secret);
  expect(await confirmMfaEnrollment(userId, code)).toBe(true);
  return enrollment;
}

describe("multi-factor authentication flow", () => {
  let userId: string;

  beforeEach(async () => {
    userId = await registerAdult();
  });

  it("stores only encrypted secrets and hashed recovery codes", async () => {
    expect(await getMfaStatus(userId)).toMatchObject({
      enabled: false,
      recoveryCodesRemaining: 0,
    });

    const enrollment = await beginMfaEnrollment(userId);
    expect(enrollment).not.toBeNull();
    if (!enrollment) return;
    expect(enrollment.recoveryCodes).toHaveLength(8);
    expect(enrollment.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(enrollment.provisioningUri).toContain("otpauth://");

    const stored = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { mfaSecret: true, mfaEnabledAt: true },
    });
    expect(stored.mfaSecret).toBeTruthy();
    expect(stored.mfaSecret).not.toContain(enrollment.secret);
    expect(stored.mfaEnabledAt).toBeNull();

    const codes = await db.mfaRecoveryCode.findMany({
      where: { userId },
      select: { codeHash: true },
    });
    expect(codes).toHaveLength(8);
    for (const plain of enrollment.recoveryCodes) {
      const hashed = hashToken(plain.toUpperCase().replace(/[^A-F0-9]/g, ""));
      expect(codes.some((code) => code.codeHash === hashed)).toBe(true);
      expect(codes.some((code) => code.codeHash === plain)).toBe(false);
    }
  });

  it("requires a valid live code to complete enrollment", async () => {
    const enrollment = await beginMfaEnrollment(userId);
    if (!enrollment) throw new Error("enrollment failed");

    expect(await confirmMfaEnrollment(userId, "000000")).toBe(false);
    expect((await getMfaStatus(userId)).enabled).toBe(false);

    expect(
      await confirmMfaEnrollment(userId, generateTotpCode(enrollment.secret)),
    ).toBe(true);
    expect((await getMfaStatus(userId)).enabled).toBe(true);

    const events = await db.auditEvent.findMany({
      where: { actorId: userId, action: "auth.mfa_enrolled" },
    });
    expect(events).toHaveLength(1);
  });

  it("refuses to silently replace an already-enabled second factor", async () => {
    const original = await enroll(userId);
    const before = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { mfaSecret: true },
    });

    expect(await beginMfaEnrollment(userId)).toBeNull();

    const after = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { mfaSecret: true },
    });
    expect(after.mfaSecret).toBe(before.mfaSecret);
    const codes = await db.mfaRecoveryCode.count({ where: { userId } });
    expect(codes).toBe(8);
    expect(original.recoveryCodes).toHaveLength(8);
  });

  it("does not create a session from a password alone and consumes the challenge once", async () => {
    const enrollment = await enroll(userId);

    const passwordLogin = await authenticate({
      email: (
        await db.user.findUniqueOrThrow({
          where: { id: userId },
          select: { email: true },
        })
      ).email,
      password: PASSWORD,
    });
    expect(passwordLogin.ok).toBe(true);
    if (!passwordLogin.ok || !passwordLogin.mfaRequired) {
      throw new Error("expected an MFA challenge");
    }
    expect("sessionToken" in passwordLogin).toBe(false);

    const challenge = passwordLogin.mfaChallengeToken;
    expect(await verifyMfaChallenge(challenge, "000000")).toMatchObject({
      ok: false,
      reason: "invalid_code",
    });

    const verified = await verifyMfaChallenge(
      challenge,
      generateTotpCode(enrollment.secret),
    );
    expect(verified).toMatchObject({ ok: true, method: "totp", userId });

    // The same challenge cannot be reused, even with a valid code.
    expect(
      await verifyMfaChallenge(challenge, generateTotpCode(enrollment.secret)),
    ).toMatchObject({ ok: false, reason: "invalid_challenge" });

    const login = await completeMfaLogin(userId);
    expect(login).not.toBeNull();
    if (!login) return;
    expect(await validateSessionToken(login.sessionToken)).not.toBeNull();

    const failures = await db.auditEvent.findMany({
      where: { actorId: userId, action: "auth.mfa_verify_failed" },
    });
    expect(failures).toHaveLength(1);
  });

  it("accepts each recovery code once and records its use", async () => {
    const enrollment = await enroll(userId);
    const recoveryCode = enrollment.recoveryCodes[0];

    const first = await issueMfaChallenge(userId);
    expect(await verifyMfaChallenge(first, recoveryCode)).toMatchObject({
      ok: true,
      method: "recovery",
      userId,
    });

    const used = await db.mfaRecoveryCode.findFirst({
      where: {
        userId,
        codeHash: hashToken(
          recoveryCode.toUpperCase().replace(/[^A-F0-9]/g, ""),
        ),
      },
      select: { usedAt: true },
    });
    expect(used?.usedAt).toBeInstanceOf(Date);

    const second = await issueMfaChallenge(userId);
    expect(await verifyMfaChallenge(second, recoveryCode)).toMatchObject({
      ok: false,
      reason: "invalid_code",
    });

    const recoveryEvents = await db.auditEvent.findMany({
      where: { actorId: userId, action: "auth.mfa_recovery_used" },
    });
    expect(recoveryEvents).toHaveLength(1);
  });

  it("requires a valid second factor to disable MFA and clears all state", async () => {
    const enrollment = await enroll(userId);

    expect(await disableMfa(userId, "000000")).toBe(false);
    expect((await getMfaStatus(userId)).enabled).toBe(true);

    expect(await disableMfa(userId, generateTotpCode(enrollment.secret))).toBe(
      true,
    );

    const status = await getMfaStatus(userId);
    expect(status).toMatchObject({ enabled: false, recoveryCodesRemaining: 0 });
    const stored = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { mfaSecret: true, mfaEnabledAt: true },
    });
    expect(stored.mfaSecret).toBeNull();
    expect(stored.mfaEnabledAt).toBeNull();
    expect(await db.mfaRecoveryCode.count({ where: { userId } })).toBe(0);

    const events = await db.auditEvent.findMany({
      where: { actorId: userId, action: "auth.mfa_disabled" },
    });
    expect(events).toHaveLength(1);

    // After disabling, a password alone creates a session again.
    const email = (
      await db.user.findUniqueOrThrow({
        where: { id: userId },
        select: { email: true },
      })
    ).email;
    const login = await authenticate({ email, password: PASSWORD });
    expect(login.ok).toBe(true);
    if (login.ok && !login.mfaRequired) {
      expect(await validateSessionToken(login.sessionToken)).not.toBeNull();
    }
  });
});
