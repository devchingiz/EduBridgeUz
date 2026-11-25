import { describe, expect, it, vi } from "vitest";

import { decryptMfaSecret, encryptMfaSecret } from "@/lib/auth/mfa-secret";
import {
  generateTotpSecret,
  totpProvisioningUri,
  verifyTotp,
} from "@/lib/auth/totp";
import { mfaCodeSchema, mfaConfirmSchema } from "@/lib/validation/auth";

// RFC 6238 SHA-1 test secret: the ASCII string "12345678901234567890".
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("TOTP", () => {
  it("matches the RFC 6238 known-answer vectors", () => {
    // RFC 6238 publishes 8-digit values; these are their 6-digit truncations.
    const vectors: Array<[number, string]> = [
      [59, "287082"],
      [1111111109, "081804"],
      [1111111111, "050471"],
      [1234567890, "005924"],
      [2000000000, "279037"],
      [20000000000, "353130"],
    ];

    for (const [seconds, code] of vectors) {
      expect(verifyTotp(RFC_SECRET, code, seconds * 1000)).toBe(true);
    }
  });

  it("rejects wrong, malformed, and out-of-window codes", () => {
    expect(verifyTotp(RFC_SECRET, "000000", 59_000)).toBe(false);
    expect(verifyTotp(RFC_SECRET, "12345", 59_000)).toBe(false);
    expect(verifyTotp(RFC_SECRET, "1234567", 59_000)).toBe(false);
    expect(verifyTotp(RFC_SECRET, "abcdef", 59_000)).toBe(false);
    // A valid code from an hour later must not be accepted.
    expect(verifyTotp(RFC_SECRET, "287082", 59_000 + 3_600_000)).toBe(false);
  });

  it("generates a 160-bit base32 secret and an otpauth URI", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(secret).not.toBe(RFC_SECRET);

    const uri = totpProvisioningUri(secret, "student+1@example.com");
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("issuer=EduBridge");
    expect(uri).toContain("algorithm=SHA1");
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
    expect(uri).toContain(encodeURIComponent(secret));
  });
});

describe("MFA secret encryption", () => {
  it("round-trips a secret and never stores it in plaintext", () => {
    const secret = generateTotpSecret();
    const stored = encryptMfaSecret(secret);

    expect(stored.split(".")).toHaveLength(3);
    expect(stored).not.toContain(secret);
    expect(decryptMfaSecret(stored)).toBe(secret);
  });

  it("uses a fresh IV for each encryption", () => {
    const secret = generateTotpSecret();
    expect(encryptMfaSecret(secret)).not.toBe(encryptMfaSecret(secret));
  });

  it("fails closed on tampering and malformed values", () => {
    const stored = encryptMfaSecret(generateTotpSecret());
    const [iv, tag, ciphertext] = stored.split(".");

    expect(() =>
      decryptMfaSecret([iv, tag, `${ciphertext}AA`].join(".")),
    ).toThrow();
    expect(() => decryptMfaSecret("not-a-valid-secret")).toThrow();

    vi.stubEnv("MFA_ENCRYPTION_KEY", "a-completely-different-key-value-12345");
    try {
      expect(() => decryptMfaSecret(stored)).toThrow();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("MFA code validation", () => {
  it("accepts a 6-digit code or a formatted recovery code", () => {
    expect(mfaCodeSchema.safeParse({ code: "123456" }).success).toBe(true);
    expect(
      mfaCodeSchema.safeParse({ code: "ABCD-1234-CDEF-5678" }).success,
    ).toBe(true);
    expect(mfaCodeSchema.safeParse({ code: "short" }).success).toBe(false);
    expect(mfaCodeSchema.safeParse({ code: "12345" }).success).toBe(false);
  });

  it("requires a pure 6-digit code when confirming enrollment", () => {
    expect(mfaConfirmSchema.safeParse({ code: "123456" }).success).toBe(true);
    expect(
      mfaConfirmSchema.safeParse({ code: "ABCD-1234-CDEF-5678" }).success,
    ).toBe(false);
  });
});
