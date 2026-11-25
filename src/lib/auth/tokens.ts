import "server-only";

import type { TokenPurpose } from "@prisma/client";

import { db } from "@/lib/db";
import { generateToken, hashToken } from "@/lib/security/crypto";

export const TOKEN_TTL = {
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 30 * 60 * 1000,
  GUARDIAN_CONSENT: 7 * 24 * 60 * 60 * 1000,
  /** Short-lived, single-use second-factor challenge. */
  MFA_CHALLENGE: 5 * 60 * 1000,
} as const;

export type IssuedToken = {
  token: string;
  expiresAt: Date;
};

/**
 * Issues a single-use token and returns the raw value exactly once. Only the
 * SHA-256 hash is persisted.
 */
export async function issueToken(input: {
  userId: string;
  purpose: TokenPurpose;
  email?: string | null;
  ttlMs?: number;
}): Promise<IssuedToken> {
  const token = generateToken();
  const expiresAt = new Date(
    Date.now() + (input.ttlMs ?? TOKEN_TTL[input.purpose]),
  );

  await db.$transaction([
    // A new link invalidates older unused links for the same purpose.
    db.authToken.updateMany({
      where: {
        userId: input.userId,
        purpose: input.purpose,
        usedAt: null,
      },
      data: { usedAt: new Date() },
    }),
    db.authToken.create({
      data: {
        userId: input.userId,
        purpose: input.purpose,
        tokenHash: hashToken(token),
        email: input.email ?? null,
        expiresAt,
      },
    }),
  ]);

  return { token, expiresAt };
}

export type TokenRecord = {
  id: string;
  userId: string;
  purpose: TokenPurpose;
  email: string | null;
  expiresAt: Date;
  user: {
    id: string;
    email: string;
    name: string;
    emailVerifiedAt: Date | null;
    dateOfBirth: Date | null;
  };
};

/** Reads a token without consuming it, for rendering a confirmation screen. */
export async function findToken(
  token: string,
  purpose: TokenPurpose,
): Promise<TokenRecord | null> {
  if (!token || token.length < 20) return null;

  const record = await db.authToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      userId: true,
      purpose: true,
      email: true,
      expiresAt: true,
      usedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          emailVerifiedAt: true,
          dateOfBirth: true,
        },
      },
    },
  });

  if (
    !record ||
    record.purpose !== purpose ||
    record.usedAt ||
    record.expiresAt <= new Date()
  ) {
    return null;
  }

  return {
    id: record.id,
    userId: record.userId,
    purpose: record.purpose,
    email: record.email,
    expiresAt: record.expiresAt,
    user: record.user,
  };
}

/**
 * Atomically marks a token used. The conditional `updateMany` guarantees a
 * token can be redeemed only once even under concurrent requests.
 */
export async function consumeToken(
  token: string,
  purpose: TokenPurpose,
): Promise<TokenRecord | null> {
  if (!token || token.length < 20) return null;

  const tokenHash = hashToken(token);
  const now = new Date();

  const result = await db.authToken.updateMany({
    where: {
      tokenHash,
      purpose,
      usedAt: null,
      expiresAt: { gt: now },
    },
    data: { usedAt: now },
  });

  if (result.count !== 1) return null;

  const record = await db.authToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      purpose: true,
      email: true,
      expiresAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          emailVerifiedAt: true,
          dateOfBirth: true,
        },
      },
    },
  });

  return record ?? null;
}
