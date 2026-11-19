import { describe, expect, it } from "vitest";

import {
  changePasswordSchema,
  deleteAccountSchema,
  parseBudgetAmount,
  profileSchema,
  registerFormSchema,
  registerSchema,
  toFieldErrors,
} from "@/lib/validation/auth";

const baseRegistration = {
  name: "Amina Karimova",
  email: "Amina@Example.com",
  password: "Correct-Horse-Battery-9",
  confirmPassword: "Correct-Horse-Battery-9",
  dateOfBirth: "2000-05-10",
  guardianName: "",
  guardianEmail: "",
  acceptTerms: true,
};

describe("registerSchema", () => {
  it("normalises the email and accepts an adult", () => {
    const parsed = registerSchema.parse(baseRegistration);
    expect(parsed.email).toBe("amina@example.com");
  });

  it("requires guardian details for a minor", () => {
    const result = registerSchema.safeParse({
      ...baseRegistration,
      dateOfBirth: "2010-05-10",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = toFieldErrors(result.error);
    expect(errors.guardianName).toContain("guardian's name");
    expect(errors.guardianEmail).toContain("guardian's email");
  });

  it("rejects a guardian email that matches the student's email", () => {
    const result = registerSchema.safeParse({
      ...baseRegistration,
      dateOfBirth: "2010-05-10",
      guardianName: "Dilnoza Karimova",
      guardianEmail: "Amina@Example.com",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(toFieldErrors(result.error).guardianEmail).toContain(
      "different email",
    );
  });

  it("rejects mismatched passwords and missing consent", () => {
    const mismatch = registerSchema.safeParse({
      ...baseRegistration,
      confirmPassword: "Different-Password-42",
    });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) {
      expect(toFieldErrors(mismatch.error).confirmPassword).toBe(
        "Passwords do not match.",
      );
    }

    const noConsent = registerSchema.safeParse({
      ...baseRegistration,
      acceptTerms: false,
    });
    expect(noConsent.success).toBe(false);
  });

  it("rejects future and under-age dates of birth", () => {
    const future = registerSchema.safeParse({
      ...baseRegistration,
      dateOfBirth: "2999-01-01",
    });
    expect(future.success).toBe(false);

    const tooYoung = registerSchema.safeParse({
      ...baseRegistration,
      dateOfBirth: "2020-01-01",
    });
    expect(tooYoung.success).toBe(false);
  });
});

describe("registerFormSchema", () => {
  it("accepts one full-name field without a confirm-password field", () => {
    const parsed = registerFormSchema.parse({
      name: " Amina Karimova ",
      email: "Amina@Example.com",
      password: "Correct-Horse-Battery-9",
      dateOfBirth: "2000-05-10",
      guardianName: "",
      guardianEmail: "",
      acceptTerms: true,
    });

    expect(parsed.name).toBe("Amina Karimova");
    expect(parsed.email).toBe("amina@example.com");
  });

  it("requires a name and still applies guardian rules for minors", () => {
    const missingName = registerFormSchema.safeParse({
      name: " ",
      email: "amina@example.com",
      password: "Correct-Horse-Battery-9",
      dateOfBirth: "2000-05-10",
      acceptTerms: true,
    });
    expect(missingName.success).toBe(false);
    if (!missingName.success) {
      expect(toFieldErrors(missingName.error).name).toBe("Enter your name.");
    }

    const minor = registerFormSchema.safeParse({
      name: "Timur Aliyev",
      email: "timur@example.com",
      password: "Correct-Horse-Battery-9",
      dateOfBirth: "2010-05-10",
      acceptTerms: true,
    });
    expect(minor.success).toBe(false);
    if (!minor.success) {
      const errors = toFieldErrors(minor.error);
      expect(errors.guardianName).toContain("guardian's name");
      expect(errors.guardianEmail).toContain("guardian's email");
    }
  });
});

describe("profileSchema", () => {
  it("accepts a complete profile", () => {
    const result = profileSchema.safeParse({
      name: "Amina Karimova",
      nationality: "UZ",
      residenceCountry: "KZ",
      currentDegree: "BACHELOR",
      targetDegree: "MASTER",
      fieldsOfStudy: ["Computer Science", "Engineering"],
      englishTest: "IELTS",
      englishScore: "6.5",
      budgetAmount: "12,000",
      budgetCurrency: "USD",
      guardianName: "",
      guardianEmail: "",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.guardianName).toBeNull();
    expect(result.data.guardianEmail).toBeNull();
  });

  it("rejects unknown countries, degrees, fields, and currencies", () => {
    expect(
      profileSchema.safeParse({
        name: "Amina Karimova",
        nationality: "XX",
      }).success,
    ).toBe(false);

    expect(
      profileSchema.safeParse({
        name: "Amina Karimova",
        targetDegree: "DOCTORATE",
      }).success,
    ).toBe(false);

    expect(
      profileSchema.safeParse({
        name: "Amina Karimova",
        fieldsOfStudy: ["Underwater Basket Weaving"],
      }).success,
    ).toBe(false);

    expect(
      profileSchema.safeParse({
        name: "Amina Karimova",
        budgetCurrency: "XYZ",
      }).success,
    ).toBe(false);
  });

  it("caps the number of selected fields", () => {
    const result = profileSchema.safeParse({
      name: "Amina Karimova",
      fieldsOfStudy: [
        "Computer Science",
        "Engineering",
        "Law",
        "Education",
        "Natural Sciences",
        "Other",
        "Arts & Humanities",
      ],
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(toFieldErrors(result.error).fieldsOfStudy).toContain("six");
  });
});

describe("parseBudgetAmount", () => {
  it("accepts whole numbers with optional separators", () => {
    expect(parseBudgetAmount("12000")).toBe(12_000);
    expect(parseBudgetAmount("12,000")).toBe(12_000);
    expect(parseBudgetAmount(" 1 000 ")).toBe(1_000);
    expect(parseBudgetAmount("1000000000")).toBe(1_000_000_000);
  });

  it("rejects empty, fractional, zero, and oversized values", () => {
    expect(parseBudgetAmount("")).toBeNull();
    expect(parseBudgetAmount(null)).toBeNull();
    expect(parseBudgetAmount("0")).toBeNull();
    expect(parseBudgetAmount("12.5")).toBeNull();
    expect(parseBudgetAmount("1000000001")).toBeNull();
    expect(parseBudgetAmount("not-a-number")).toBeNull();
  });
});

describe("other schemas", () => {
  it("rejects reusing the current password", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "Correct-Horse-Battery-9",
      password: "Correct-Horse-Battery-9",
      confirmPassword: "Correct-Horse-Battery-9",
    });
    expect(result.success).toBe(false);
  });

  it("requires the exact deletion confirmation", () => {
    expect(
      deleteAccountSchema.safeParse({ password: "x", confirmation: "delete" })
        .success,
    ).toBe(false);
    expect(
      deleteAccountSchema.safeParse({ password: "x", confirmation: "DELETE" })
        .success,
    ).toBe(true);
  });
});
