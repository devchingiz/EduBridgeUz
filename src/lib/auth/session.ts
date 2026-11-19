import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import type { Role } from "@prisma/client";

import { db } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { isProduction } from "@/lib/env";
import {
  generateToken,
  hashIdentifier,
  hashToken,
} from "@/lib/security/crypto";

export { SESSION_COOKIE };

/** Idle expiry, refreshed while the user is active. */
const IDLE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Hard cap regardless of activity. */
const ABSOLUTE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Cookie lifetime mirrors the absolute session cap. */
export const SESSION_COOKIE_MAX_AGE = Math.floor(ABSOLUTE_TTL_MS / 1000);
/** Renew the idle window when fewer than six days remain. */
const RENEW_THRESHOLD_MS = IDLE_TTL_MS - 24 * 60 * 60 * 1000;
/** Avoid a write on every request. */
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  emailVerifiedAt: Date | null;
  dateOfBirth: Date | null;
  createdAt: Date;
};

export type SessionRecord = {
  id: string;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  userAgent: string | null;
  ipHash: string | null;
};

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  emailVerifiedAt: true,
  dateOfBirth: true,
  createdAt: true,
  deletedAt: true,
} as const;

export async function createSession(
  userId: string,
  context: { ip?: string; userAgent?: string | null } = {},
): Promise<{ token: string; sessionId: string; expiresAt: Date }> {
  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + IDLE_TTL_MS);

  const session = await db.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      userAgent: context.userAgent ?? null,
      ipHash:
        context.ip && context.ip !== "unknown"
          ? hashIdentifier(context.ip)
          : null,
      expiresAt,
    },
    select: { id: true },
  });

  return { token, sessionId: session.id, expiresAt };
}

/**
 * Writes the session cookie. Must only be called from a Server Action or Route
 * Handler; Next.js does not allow cookie mutation during a page render.
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
    priority: "high",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

/**
 * Validates an opaque session token, enforces idle and absolute expiry, and
 * slides the idle window. Returns a minimal user DTO, never the password hash.
 */
export async function validateSessionToken(token: string): Promise<{
  session: SessionRecord;
  user: SessionUser;
} | null> {
  if (!token || token.length < 20) return null;

  const record = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
      userAgent: true,
      ipHash: true,
      user: { select: userSelect },
    },
  });

  if (!record || record.revokedAt) return null;

  const now = new Date();

  if (record.expiresAt <= now) return null;

  const absoluteExpiry = new Date(record.createdAt.getTime() + ABSOLUTE_TTL_MS);
  if (absoluteExpiry <= now) {
    await db.session.update({
      where: { id: record.id },
      data: { revokedAt: now },
    });
    return null;
  }

  if (record.user.deletedAt) return null;

  const shouldExtend =
    record.expiresAt.getTime() - now.getTime() < RENEW_THRESHOLD_MS;
  const shouldTouch =
    now.getTime() - record.lastUsedAt.getTime() > TOUCH_INTERVAL_MS;

  let expiresAt = record.expiresAt;
  if (shouldExtend) {
    expiresAt = new Date(
      Math.min(now.getTime() + IDLE_TTL_MS, absoluteExpiry.getTime()),
    );
  }

  if (shouldExtend || shouldTouch) {
    await db.session.update({
      where: { id: record.id },
      data: {
        ...(shouldExtend ? { expiresAt } : {}),
        ...(shouldTouch ? { lastUsedAt: now } : {}),
      },
    });
  }

  const { deletedAt: _deletedAt, ...user } = record.user;

  return {
    session: {
      id: record.id,
      createdAt: record.createdAt,
      lastUsedAt: record.lastUsedAt,
      expiresAt,
      userAgent: record.userAgent,
      ipHash: record.ipHash,
    },
    user,
  };
}

/**
 * Cached per render pass so a layout, page, and component do not each hit the
 * database. Server Actions are not a render pass, so each call re-validates.
 */
export const getSession = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSessionToken(token);
});

export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await db.session.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  await clearSessionCookie();
}

export async function revokeSession(
  sessionId: string,
  userId: string,
): Promise<boolean> {
  const result = await db.session.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count === 1;
}

export async function revokeAllSessions(
  userId: string,
  exceptSessionId?: string,
): Promise<number> {
  const result = await db.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

export async function listSessions(userId: string) {
  return db.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: {
      id: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
      userAgent: true,
      ipHash: true,
    },
    orderBy: { lastUsedAt: "desc" },
  });
}
