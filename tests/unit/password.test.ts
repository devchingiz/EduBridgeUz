import { describe, expect, it } from "vitest";

import {
  checkPassword,
  hashPassword,
  verifyPassword,
} from "@/lib/security/password";

const STRONG = "Correct-Horse-Battery-9";

describe("checkPassword", () => {
  it("accepts a long, varied passphrase", () => {
    expect(checkPassword(STRONG, { email: "amina@example.com" })).toEqual({
      ok: true,
    });
  });

  it("rejects short passwords", () => {
    const result = checkPassword("Short-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.join(" ")).toContain("at least 12");
  });

  it("rejects common passwords and repetitive strings", () => {
    const common = checkPassword("password1234");
    expect(common.ok).toBe(false);

    const repetitive = checkPassword("aaaaaaaaaaaaaa");
    expect(repetitive.ok).toBe(false);
  });

  it("rejects passwords containing the email local part or name", () => {
    const withEmail = checkPassword("amina-is-my-password", {
      email: "amina@example.com",
    });
    expect(withEmail.ok).toBe(false);

    const withName = checkPassword("Karimova-strong-pass", {
      name: "Amina Karimova",
    });
    expect(withName.ok).toBe(false);
  });
});

describe("password hashing", () => {
  it("hashes with Argon2id and verifies without storing the plaintext", async () => {
    const hash = await hashPassword(STRONG);

    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain(STRONG);
    expect(await verifyPassword(hash, STRONG)).toBe(true);
    expect(await verifyPassword(hash, "Wrong-Password-123")).toBe(false);
  });

  it("returns false for malformed hashes instead of throwing", async () => {
    expect(await verifyPassword("not-a-hash", STRONG)).toBe(false);
  });
});
