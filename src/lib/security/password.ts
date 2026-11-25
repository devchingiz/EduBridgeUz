import "server-only";

import { hash, verify } from "@node-rs/argon2";

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/constants";
import {
  isPasswordBreached,
  shouldCheckBreaches,
} from "@/lib/security/breached-password";

/**
 * OWASP-recommended Argon2id baseline: 19 MiB memory, 2 iterations,
 * single lane. Parameters are stored in the hash string, so they can be raised
 * later without invalidating existing passwords.
 */
const ARGON2_OPTIONS = {
  // Algorithm.Argon2id. The package declares `Algorithm` as an ambient const
  // enum, which cannot be read when `isolatedModules` is enabled.
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

/**
 * A deliberately small local denylist. It runs before the network-backed
 * breached-password check and covers obvious choices even when offline.
 */
const COMMON_PASSWORDS = new Set([
  "123456789012",
  "password1234",
  "passwordpassword",
  "qwertyuiop12",
  "qwerty123456",
  "letmein12345",
  "welcome12345",
  "iloveyou1234",
  "admin1234567",
  "changeme1234",
  "password123!",
  "password12345",
  "password123456",
  "qwerty12345678",
  "abc123456789",
  "111111111111",
  "123123123123",
  "000000000000",
  "edubridge123",
  "edubridge2026",
  "university12",
  "scholarship1",
  "student12345",
]);

export type PasswordCheck = { ok: true } | { ok: false; errors: string[] };

export function checkPassword(
  password: string,
  context: { email?: string; name?: string } = {},
): PasswordCheck {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push(`Use at most ${PASSWORD_MAX_LENGTH} characters.`);
  }

  const lower = password.toLowerCase();

  if (COMMON_PASSWORDS.has(lower)) {
    errors.push("This password appears in common-password lists.");
  }

  if (new Set(password).size < 4) {
    errors.push("Use a less repetitive password.");
  }

  const emailLocal = context.email?.split("@")[0]?.toLowerCase();
  if (emailLocal && emailLocal.length >= 4 && lower.includes(emailLocal)) {
    errors.push("Do not include your email address in your password.");
  }

  for (const part of (context.name ?? "").toLowerCase().split(/\s+/)) {
    if (part.length >= 4 && lower.includes(part)) {
      errors.push("Do not include your name in your password.");
      break;
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/** Fails closed in production when the breached-password provider is unreachable. */
export async function enforceBreachedPasswordPolicy(
  password: string,
): Promise<PasswordCheck> {
  if (!shouldCheckBreaches()) return { ok: true };

  const result = await isPasswordBreached(password);
  if (!result.ok) {
    return {
      ok: false,
      errors: [
        "We could not verify this password right now. Please try again.",
      ],
    };
  }
  if (result.breached) {
    return {
      ok: false,
      errors: [
        "This password has appeared in a known data breach. Choose a different one.",
      ],
    };
  }
  return { ok: true };
}

/** Local rules plus the breached-password check, used at validation boundaries. */
export async function enforcePasswordPolicy(
  password: string,
  context: { email?: string; name?: string } = {},
): Promise<PasswordCheck> {
  const local = checkPassword(password, context);
  if (!local.ok) return local;
  return enforceBreachedPasswordPolicy(password);
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, password, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * Verifying against a real hash keeps failed-login timing close to the
 * success path, which makes email enumeration by timing harder.
 */
export async function consumeDummyVerification(): Promise<void> {
  dummyHash ??= hashPassword("edubridge-timing-equalizer-not-a-real-password");
  const value = await dummyHash;
  await verifyPassword(value, "incorrect-password-value");
}
