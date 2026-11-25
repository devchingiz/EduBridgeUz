import "server-only";

import { createHash } from "node:crypto";

import { isProduction } from "@/lib/env";
import { logWarn } from "@/lib/observability/logger";

const RANGE_URL = "https://api.pwnedpasswords.com/range/";
const REQUEST_TIMEOUT_MS = 2_500;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_CACHED_RANGES = 256;
const MAX_RESPONSE_BYTES = 200_000;
const SHA1_SUFFIX = /^[0-9A-F]{35}$/;

type RangeEntry = { expiresAt: number; suffixes: Set<string> };

/** Only the first five SHA-1 characters ever leave the process. */
const cache = new Map<string, RangeEntry>();

/**
 * Production always enforces the check and fails closed. Outside production it
 * is opt-in so local development and tests do not need external network access.
 */
export function shouldCheckBreaches(): boolean {
  return isProduction() || process.env.HIBP_ENABLED?.trim() === "true";
}

/** Exposed only so tests can assert the cache is bounded in size. */
export function cachedRangeCountForTests(): number {
  return cache.size;
}

export function resetBreachedPasswordCacheForTests(): void {
  cache.clear();
}

async function fetchRange(prefix: string): Promise<RangeEntry | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${RANGE_URL}${prefix}`, {
      headers: {
        "Add-Padding": "true",
        "User-Agent": "EduBridge-password-policy/1.0",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return null;

    const body = await response.text();
    if (body.length > MAX_RESPONSE_BYTES) return null;

    const suffixes = new Set<string>();
    for (const line of body.split(/\r?\n/)) {
      const separator = line.indexOf(":");
      if (separator === -1) continue;

      const suffix = line.slice(0, separator).trim().toUpperCase();
      if (!SHA1_SUFFIX.test(suffix)) continue;

      const count = Number(line.slice(separator + 1).trim());
      if (!Number.isSafeInteger(count) || count <= 0) continue;

      suffixes.add(suffix);
    }

    return { expiresAt: Date.now() + CACHE_TTL_MS, suffixes };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type BreachLookup =
  { ok: true; breached: boolean } | { ok: false; reason: "unavailable" };

/**
 * Queries the Have I Been Pwned k-anonymity range API. The password and the
 * full SHA-1 digest are never transmitted, logged, or cached; only a five
 * character prefix and the parsed suffix set are used.
 */
export async function isPasswordBreached(
  password: string,
): Promise<BreachLookup> {
  const digest = createHash("sha1")
    .update(password, "utf8")
    .digest("hex")
    .toUpperCase();
  const prefix = digest.slice(0, 5);
  const suffix = digest.slice(5);

  let entry = cache.get(prefix);
  if (!entry || entry.expiresAt <= Date.now()) {
    const fetched = await fetchRange(prefix);
    if (!fetched) {
      logWarn("security.password_breach_check_unavailable", {
        reason: "hibp_range_fetch_failed",
      });
      return { ok: false, reason: "unavailable" };
    }

    if (cache.size >= MAX_CACHED_RANGES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(prefix, fetched);
    entry = fetched;
  }

  return { ok: true, breached: entry.suffixes.has(suffix) };
}
