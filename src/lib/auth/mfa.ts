import "server-only";

import { randomBytes } from "node:crypto";

import { recordAuditEvent } from "@/lib/auth/audit";
import { decryptMfaSecret, encryptMfaSecret } from "@/lib/auth/mfa-secret";
import {
  generateTotpSecret,
  totpProvisioningUri,
  verifyTotp,
} from "@/lib/auth/totp";
import { consumeToken, findToken, issueToken } from "@/lib/auth/tokens";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/security/crypto";

const RECOVERY_CODE_COUNT = 8;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export type MfaStatus = {
  enabled: boolean;
  enabledAt: Date | null;
  recoveryCodesRemaining: number;
};

export async function getMfaStatus(userId: string): Promise<MfaStatus> {
  const [user, remaining] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { mfaEnabledAt: true },
    }),
    db.mfaRecoveryCode.count({
      where: { userId, usedAt: null },
    }),
  ]);

  return {
    enabled: Boolean(user?.mfaEnabledAt),
    enabledAt: user?.mfaEnabledAt ?? null,
    recoveryCodesRemaining: remaining,
  };
}

function generateRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const hex = randomBytes(8).toString("hex").toUpperCase();
    return [
      hex.slice(0, 4),
      hex.slice(4, 8),
      hex.slice(8, 12),
      hex.slice(12),
    ].join("-");
  });
}

function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[^A-F0-9]/g, "");
}

const isRecoveryCodeFormat = (code: string): boolean =>
  /^[A-F0-9]{16}$/.test(normalizeRecoveryCode(code));

export type MfaEnrollment = {
  secret: string;
  provisioningUri: string;
  recoveryCodes: string[];
};

/**
 * Generates a new pending secret and one-time codes. MFA stays disabled until
 * `confirmMfaEnrollment` verifies a live code from the user's authenticator.
 */
export async function beginMfaEnrollment(
  userId: string,
  ip?: string,
): Promise<MfaEnrollment | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, mfaEnabledAt: true },
  });
  // Re-enrollment must be an explicit action: never silently replace an
  // enrolled account's second factor or recovery codes.
  if (!user || user.mfaEnabledAt) return null;

  const secret = generateTotpSecret();
  const recoveryCodes = generateRecoveryCodes();

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { mfaSecret: encryptMfaSecret(secret), mfaEnabledAt: null },
    }),
    db.mfaRecoveryCode.deleteMany({ where: { userId } }),
    ...recoveryCodes.map((code) =>
      db.mfaRecoveryCode.create({
        data: {
          userId,
          codeHash: hashToken(normalizeRecoveryCode(code)),
        },
      }),
    ),
  ]);

  await recordAuditEvent({
    actorId: userId,
    action: "auth.mfa_enrollment_started",
    entityType: "User",
    entityId: userId,
    ip,
  });

  return {
    secret,
    provisioningUri: totpProvisioningUri(secret, user.email),
    recoveryCodes,
  };
}

export async function confirmMfaEnrollment(
  userId: string,
  code: string,
  ip?: string,
): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { mfaSecret: true, mfaEnabledAt: true },
  });
  if (!user?.mfaSecret || user.mfaEnabledAt) return false;

  const valid = verifyTotp(decryptMfaSecret(user.mfaSecret), code);
  if (!valid) return false;

  await db.user.update({
    where: { id: userId },
    data: { mfaEnabledAt: new Date() },
  });
  await recordAuditEvent({
    actorId: userId,
    action: "auth.mfa_enrolled",
    entityType: "User",
    entityId: userId,
    ip,
  });
  return true;
}

export async function disableMfa(
  userId: string,
  code: string,
  ip?: string,
): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { mfaSecret: true, mfaEnabledAt: true },
  });
  if (!user?.mfaEnabledAt || !user.mfaSecret) return false;

  let valid = verifyTotp(decryptMfaSecret(user.mfaSecret), code);
  if (!valid && isRecoveryCodeFormat(code)) {
    const codeHash = hashToken(normalizeRecoveryCode(code));
    const record = await db.mfaRecoveryCode.findFirst({
      where: { userId, codeHash, usedAt: null },
      select: { id: true },
    });
    if (record) {
      const consumed = await db.mfaRecoveryCode.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      valid = consumed.count === 1;
    }
  }
  if (!valid) return false;

  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { mfaSecret: null, mfaEnabledAt: null },
    }),
    db.mfaRecoveryCode.deleteMany({ where: { userId } }),
  ]);
  await recordAuditEvent({
    actorId: userId,
    action: "auth.mfa_disabled",
    entityType: "User",
    entityId: userId,
    ip,
  });
  return true;
}

export async function issueMfaChallenge(userId: string): Promise<string> {
  const challenge = await issueToken({
    userId,
    purpose: "MFA_CHALLENGE",
    ttlMs: CHALLENGE_TTL_MS,
  });
  return challenge.token;
}

export type MfaVerification =
  | { ok: true; userId: string; method: "totp" | "recovery" }
  | { ok: false; reason: "invalid_challenge" | "invalid_code" };

/**
 * Verifies a second factor against a still-unused challenge. The challenge is
 * consumed only after a valid factor, so a failed attempt does not burn it.
 */
export async function verifyMfaChallenge(
  token: string,
  code: string,
  ip?: string,
): Promise<MfaVerification> {
  const challenge = await findToken(token, "MFA_CHALLENGE");
  if (!challenge) return { ok: false, reason: "invalid_challenge" };

  const user = await db.user.findUnique({
    where: { id: challenge.userId },
    select: { mfaSecret: true, mfaEnabledAt: true, deletedAt: true },
  });
  if (!user?.mfaEnabledAt || !user.mfaSecret || user.deletedAt) {
    return { ok: false, reason: "invalid_code" };
  }

  let method: "totp" | "recovery" = "totp";
  let valid = verifyTotp(decryptMfaSecret(user.mfaSecret), code);

  if (!valid && isRecoveryCodeFormat(code)) {
    method = "recovery";
    const codeHash = hashToken(normalizeRecoveryCode(code));
    const record = await db.mfaRecoveryCode.findFirst({
      where: { userId: challenge.userId, codeHash, usedAt: null },
      select: { id: true },
    });
    if (record) {
      const consumed = await db.mfaRecoveryCode.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      valid = consumed.count === 1;
    }
  }

  if (!valid) {
    await recordAuditEvent({
      actorId: challenge.userId,
      action: "auth.mfa_verify_failed",
      entityType: "User",
      entityId: challenge.userId,
      ip,
    });
    return { ok: false, reason: "invalid_code" };
  }

  const consumed = await consumeToken(token, "MFA_CHALLENGE");
  if (!consumed) return { ok: false, reason: "invalid_challenge" };

  await recordAuditEvent({
    actorId: challenge.userId,
    action: method === "totp" ? "auth.mfa_verified" : "auth.mfa_recovery_used",
    entityType: "User",
    entityId: challenge.userId,
    ip,
  });
  return { ok: true, userId: challenge.userId, method };
}
