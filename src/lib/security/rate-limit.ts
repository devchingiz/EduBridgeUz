import "server-only";

import { db } from "@/lib/db";
import { logError, logWarn } from "@/lib/observability/logger";
import { hashIdentifier } from "@/lib/security/crypto";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  limit: number;
};

export type RateLimitOptions = {
  /** Logical action, e.g. `auth.login.ip`. */
  scope: string;
  /** Email address, IP address, or user ID. Hashed before storage. */
  identifier: string;
  limit: number;
  windowSeconds: number;
};

/** Builds the storage key without ever persisting the raw identifier. */
export function rateLimitKey(scope: string, identifier: string): string {
  return `${scope}:${hashIdentifier(identifier)}`;
}

function currentWindow(windowSeconds: number) {
  const windowMs = windowSeconds * 1000;
  const startMs = Math.floor(Date.now() / windowMs) * windowMs;
  return {
    windowStart: new Date(startMs),
    expiresAt: new Date(startMs + windowMs * 2),
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((startMs + windowMs - Date.now()) / 1000),
    ),
  };
}

/**
 * Fixed-window rate limiting backed by PostgreSQL.
 *
 * A single atomic upsert means concurrent requests across server instances
 * share the same counter. The trade-off is a small burst at window boundaries;
 * that is acceptable for authentication throttling and documented in
 * docs/SECURITY.md.
 */
export async function rateLimit({
  scope,
  identifier,
  limit,
  windowSeconds,
}: RateLimitOptions): Promise<RateLimitResult> {
  const key = rateLimitKey(scope, identifier);
  const { windowStart, expiresAt, retryAfterSeconds } =
    currentWindow(windowSeconds);

  try {
    const rows = await db.$queryRaw<Array<{ count: number }>>`
      INSERT INTO "RateLimitCounter" ("key", "count", "windowStart", "expiresAt")
      VALUES (${key}, 1, ${windowStart}, ${expiresAt})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimitCounter"."windowStart" < ${windowStart} THEN 1
          ELSE "RateLimitCounter"."count" + 1
        END,
        "windowStart" = CASE
          WHEN "RateLimitCounter"."windowStart" < ${windowStart} THEN ${windowStart}
          ELSE "RateLimitCounter"."windowStart"
        END,
        "expiresAt" = CASE
          WHEN "RateLimitCounter"."windowStart" < ${windowStart} THEN ${expiresAt}
          ELSE "RateLimitCounter"."expiresAt"
        END
      RETURNING "count"
    `;

    const count = Number(rows[0]?.count ?? 1);
    const allowed = count <= limit;

    return {
      allowed,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: allowed ? 0 : retryAfterSeconds,
      limit,
    };
  } catch (error) {
    // Fail closed: without the shared counter, authentication and uploads
    // cannot safely enforce their configured limits.
    logError("security.rate_limit_store_failed", error, { scope });
    return { allowed: false, remaining: 0, retryAfterSeconds: 30, limit };
  }
}

/**
 * Reads counters without incrementing them. Used by sign-in to stop repeated
 * password guesses before the expensive hash verification while still counting
 * only failed attempts. Like `rateLimit`, it fails closed.
 */
export async function checkRateLimits(
  limits: RateLimitOptions[],
): Promise<RateLimitResult | null> {
  for (const limit of limits) {
    const { windowStart, retryAfterSeconds } = currentWindow(
      limit.windowSeconds,
    );

    try {
      const counter = await db.rateLimitCounter.findUnique({
        where: { key: rateLimitKey(limit.scope, limit.identifier) },
        select: { count: true, windowStart: true },
      });

      if (
        counter &&
        counter.windowStart >= windowStart &&
        counter.count > limit.limit
      ) {
        logWarn("security.rate_limit_denied", { scope: limit.scope });
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds,
          limit: limit.limit,
        };
      }
    } catch (error) {
      logError("security.rate_limit_check_failed", error, {
        scope: limit.scope,
      });
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: 30,
        limit: limit.limit,
      };
    }
  }

  return null;
}

/** Applies several limits in sequence and returns the first denial. */
export async function enforceRateLimits(
  limits: RateLimitOptions[],
): Promise<RateLimitResult | null> {
  for (const limit of limits) {
    const result = await rateLimit(limit);
    if (!result.allowed) {
      logWarn("security.rate_limit_denied", { scope: limit.scope });
      return result;
    }
  }
  return null;
}
