import "server-only";

import { createHmac, randomBytes } from "node:crypto";

import { safeEqual } from "@/lib/security/crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PERIOD_MS = 30_000;
const DIGITS = 6;
/** One step before and after tolerates ordinary client clock drift. */
const WINDOW_STEPS = 1;

function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input: string): Buffer {
  const normalized = input.toUpperCase().replace(/\s|=+$/g, "");
  if (!normalized || /[^A-Z2-7]/.test(normalized)) {
    throw new Error("Invalid TOTP secret.");
  }

  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const character of normalized) {
    const index = ALPHABET.indexOf(character);
    if (index === -1) throw new Error("Invalid TOTP secret.");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function hotp(key: Buffer, counter: number): string {
  if (counter < 0) return "";
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = digest.readUInt32BE(offset) & 0x7fffffff;
  return (value % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

/** A 160-bit RFC 4648 base32 secret, suitable for authenticator apps. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** Deterministic code for a given step; useful for tooling and tests. */
export function generateTotpCode(
  secret: string,
  now: number = Date.now(),
): string {
  const key = base32Decode(secret);
  const step = Math.floor(now / PERIOD_MS);
  return hotp(key, step);
}

export function verifyTotp(
  secret: string,
  code: string,
  now: number = Date.now(),
): boolean {
  if (!new RegExp(`^\\d{${DIGITS}}$`).test(code)) return false;

  const key = base32Decode(secret);
  const step = Math.floor(now / PERIOD_MS);
  for (let delta = -WINDOW_STEPS; delta <= WINDOW_STEPS; delta += 1) {
    const expected = hotp(key, step + delta);
    if (expected && safeEqual(expected, code)) return true;
  }
  return false;
}

export function totpProvisioningUri(secret: string, email: string): string {
  const label = encodeURIComponent(`EduBridge:${email}`);
  const issuer = encodeURIComponent("EduBridge");
  return (
    `otpauth://totp/${label}?secret=${encodeURIComponent(secret)}` +
    `&issuer=${issuer}&algorithm=SHA1&digits=${DIGITS}&period=${PERIOD_MS / 1000}`
  );
}
