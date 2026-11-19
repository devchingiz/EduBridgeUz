import "server-only";

import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { getAuthSecret } from "@/lib/env";

/** 32 random bytes, URL-safe. Used for session cookies and email tokens. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Tokens are stored hashed so a database leak cannot be replayed. A plain
 * SHA-256 is sufficient here because the input is 256 bits of entropy.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Keyed hash for values that are guessable (emails, IP addresses) so stored
 * rate-limit keys cannot be reversed with a dictionary attack.
 */
export function hashIdentifier(value: string): string {
  return createHmac("sha256", getAuthSecret())
    .update(value.trim().toLowerCase(), "utf8")
    .digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Short, non-reversible fingerprint for audit metadata. */
export function fingerprint(value: string): string {
  return hashIdentifier(value).slice(0, 16);
}
