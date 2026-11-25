import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

import { getMfaEncryptionKey } from "@/lib/env";

const IV_BYTES = 12;
const TAG_BYTES = 16;
const ENCODED = /^[A-Za-z0-9_-]+$/;

function encryptionKey(): Buffer {
  const material = createHash("sha512")
    .update("edubridge-mfa-seed-v1\0")
    .update(getMfaEncryptionKey(), "utf8")
    .digest();
  return material.subarray(0, 32);
}

/** AES-256-GCM, with a fresh IV per secret. Returns iv.tag.ciphertext. */
export function encryptMfaSecret(secret: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), ciphertext]
    .map((part) => part.toString("base64url"))
    .join(".");
}

/** Throws on tampering or a wrong key; callers must fail closed. */
export function decryptMfaSecret(stored: string): string {
  const parts = stored.split(".");
  if (parts.length !== 3 || parts.some((part) => !ENCODED.test(part))) {
    throw new Error("Invalid MFA secret encoding.");
  }

  const iv = Buffer.from(parts[0], "base64url");
  const tag = Buffer.from(parts[1], "base64url");
  const ciphertext = Buffer.from(parts[2], "base64url");
  if (
    iv.length !== IV_BYTES ||
    tag.length !== TAG_BYTES ||
    !ciphertext.length
  ) {
    throw new Error("Invalid MFA secret encoding.");
  }

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
