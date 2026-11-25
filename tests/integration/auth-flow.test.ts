import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { getAppUrl } from "@/lib/env";
import { POLICY_VERSION } from "@/lib/auth/constants";
import { isMinor } from "@/lib/auth/age";
import {
  authenticate,
  changePassword,
  completeGoogleSignIn,
  deleteAccount,
  recordGuardianDecision,
  registerAccount,
  requestPasswordReset,
  resendGuardianConsent,
  resendVerificationEmail,
  resetPasswordWithToken,
  updateProfile,
  verifyEmailToken,
  type RegistrationOutcome,
} from "@/lib/auth/service";
import { validateSessionToken } from "@/lib/auth/session";
import { findToken } from "@/lib/auth/tokens";
import { getWorkspaceStatus } from "@/lib/auth/dal";
import { getVerificationRequirement } from "@/lib/auth/verification-policy";
import { rateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import type { ProfileInput, RegisterInput } from "@/lib/validation/auth";

const PASSWORD = "Correct-Horse-Battery-9";
const NEW_PASSWORD = "Another-Strong-Passphrase-42";
const WEAK_PASSWORD = "Amina-Strong-Passphrase-42";
const MAIL_DIR = path.join(process.cwd(), ".data", "mail");

type MailRecord = {
  to: string;
  tag: string;
  text: string;
  html: string;
};

async function mailFileNames(): Promise<string[]> {
  try {
    return await readdir(MAIL_DIR);
  } catch {
    return [];
  }
}

async function newMailRecords(before: Set<string>): Promise<MailRecord[]> {
  const names = (await mailFileNames()).filter((name) => !before.has(name));
  return Promise.all(
    names.map(async (name) =>
      JSON.parse(await readFile(path.join(MAIL_DIR, name), "utf8")),
    ),
  );
}

function dateYearsAgo(years: number): string {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - years);
  return date.toISOString().slice(0, 10);
}

function adultInput(overrides: Partial<RegisterInput> = {}): RegisterInput {
  return {
    name: "Amina Karimova",
    email: "amina@example.com",
    password: PASSWORD,
    confirmPassword: PASSWORD,
    dateOfBirth: dateYearsAgo(22),
    guardianName: "",
    guardianEmail: "",
    acceptTerms: true,
    ...overrides,
  };
}

function minorInput(overrides: Partial<RegisterInput> = {}): RegisterInput {
  return adultInput({
    name: "Timur Aliyev",
    email: "timur@example.com",
    dateOfBirth: dateYearsAgo(16),
    guardianName: "Dilnoza Aliyev",
    guardianEmail: "guardian@example.com",
    ...overrides,
  });
}

function profileInput(overrides: Partial<ProfileInput> = {}): ProfileInput {
  return {
    name: "Amina Karimova",
    nationality: "UZ",
    residenceCountry: "UZ",
    currentDegree: "BACHELOR",
    targetDegree: "MASTER",
    fieldsOfStudy: [
      "Computer Science",
      "Engineering",
    ] as ProfileInput["fieldsOfStudy"],
    englishTest: "IELTS",
    englishScore: "6.5",
    budgetAmount: "12,000",
    budgetCurrency: "USD",
    guardianName: null,
    guardianEmail: null,
    ...overrides,
  };
}

async function registerAdult(
  overrides: Partial<RegisterInput> = {},
): Promise<Extract<RegistrationOutcome, { ok: true }>> {
  const result = await registerAccount(adultInput(overrides));
  if (!result.ok) throw new Error(`registration failed: ${result.reason}`);
  return result;
}

async function registerMinor(
  overrides: Partial<RegisterInput> = {},
): Promise<Extract<RegistrationOutcome, { ok: true }>> {
  const result = await registerAccount(minorInput(overrides));
  if (!result.ok) throw new Error(`registration failed: ${result.reason}`);
  return result;
}

beforeEach(async () => {
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "GoogleOAuthAttempt", "GoogleAccount", "AuditEvent", "ConsentRecord", "AuthToken", "Session", "StudentProfile", "RateLimitCounter", "User" RESTART IDENTITY CASCADE',
  );
});

afterAll(async () => {
  await db.$disconnect();
});

describe("registration and sign-in", () => {
  it("creates an adult account with hashed password, consents, and a session", async () => {
    const result = await registerAdult();

    const user = await db.user.findUniqueOrThrow({
      where: { id: result.userId },
      select: {
        email: true,
        passwordHash: true,
        emailVerifiedAt: true,
        role: true,
        dateOfBirth: true,
      },
    });

    expect(user.email).toBe("amina@example.com");
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.role).toBe("STUDENT");
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.passwordHash).not.toContain(PASSWORD);
    expect(user.dateOfBirth && isMinor(user.dateOfBirth)).toBe(false);

    const profile = await db.studentProfile.findUniqueOrThrow({
      where: { userId: result.userId },
    });
    expect(profile.fieldsOfStudy).toEqual([]);
    expect(profile.guardianConsentAt).toBeNull();

    const consents = await db.consentRecord.findMany({
      where: { userId: result.userId },
      select: { type: true, version: true },
      orderBy: { type: "asc" },
    });
    expect(consents).toEqual([
      { type: "TERMS", version: POLICY_VERSION },
      { type: "PRIVACY", version: POLICY_VERSION },
    ]);

    const session = await validateSessionToken(result.sessionToken);
    expect(session?.user.id).toBe(result.userId);
    expect(session?.user.email).toBe("amina@example.com");

    const audit = await db.auditEvent.findFirst({
      where: { actorId: result.userId, action: "auth.register" },
    });
    expect(audit).not.toBeNull();
  });

  it("rejects an expired session token", async () => {
    const result = await registerAdult();
    const session = await db.session.findFirstOrThrow({
      where: { userId: result.userId },
      select: { id: true },
    });

    await db.session.update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    expect(await validateSessionToken(result.sessionToken)).toBeNull();
  });

  it("verifies an email once and rejects a reused token", async () => {
    const result = await registerAdult();

    const verified = await verifyEmailToken(result.verificationToken);
    expect(verified.ok).toBe(true);

    const user = await db.user.findUniqueOrThrow({
      where: { id: result.userId },
      select: { emailVerifiedAt: true },
    });
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);

    const reused = await verifyEmailToken(result.verificationToken);
    expect(reused).toEqual({ ok: false });

    const resend = await resendVerificationEmail(result.userId);
    expect(resend).toEqual({ ok: true, alreadyVerified: true });
  });

  it("rejects invalid and expired verification tokens without logging them", async () => {
    const result = await registerAdult();
    const invalidToken = "not-a-real-verification-token-value";

    const logSpies = [
      vi.spyOn(console, "log").mockImplementation(() => {}),
      vi.spyOn(console, "info").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
      vi.spyOn(console, "error").mockImplementation(() => {}),
    ];

    try {
      expect(await findToken(invalidToken, "EMAIL_VERIFICATION")).toBeNull();
      await expect(verifyEmailToken(invalidToken)).resolves.toEqual({
        ok: false,
      });

      const tokenRecord = await db.authToken.findFirstOrThrow({
        where: {
          userId: result.userId,
          purpose: "EMAIL_VERIFICATION",
          usedAt: null,
        },
        select: { id: true },
      });
      await db.authToken.update({
        where: { id: tokenRecord.id },
        data: { expiresAt: new Date(Date.now() - 1_000) },
      });

      expect(
        await findToken(result.verificationToken, "EMAIL_VERIFICATION"),
      ).toBeNull();
      await expect(verifyEmailToken(result.verificationToken)).resolves.toEqual(
        { ok: false },
      );

      const user = await db.user.findUniqueOrThrow({
        where: { id: result.userId },
        select: { emailVerifiedAt: true },
      });
      expect(user.emailVerifiedAt).toBeNull();
    } finally {
      const output = JSON.stringify(logSpies.flatMap((spy) => spy.mock.calls));
      expect(output).not.toContain(result.verificationToken);
      expect(output).not.toContain(invalidToken);
      logSpies.forEach((spy) => spy.mockRestore());
    }
  });

  it("rejects duplicate emails, wrong passwords, and unknown accounts", async () => {
    await registerAdult();

    const duplicate = await registerAccount(adultInput());
    expect(duplicate).toEqual({ ok: false, reason: "email_taken" });

    const wrongPassword = await authenticate({
      email: "amina@example.com",
      password: "Not-The-Right-Password-1",
    });
    expect(wrongPassword.ok).toBe(false);

    const unknown = await authenticate({
      email: "nobody@example.com",
      password: PASSWORD,
    });
    expect(unknown.ok).toBe(false);

    const correct = await authenticate({
      email: "amina@example.com",
      password: PASSWORD,
    });
    expect(correct.ok).toBe(true);
  });

  it("sends recovery links without changing a verified account", async () => {
    const result = await registerAdult();
    const verified = await verifyEmailToken(result.verificationToken);
    expect(verified.ok).toBe(true);

    const before = new Set(await mailFileNames());
    const duplicate = await registerAccount(adultInput());
    expect(duplicate).toEqual({ ok: false, reason: "email_taken" });

    const user = await db.user.findUniqueOrThrow({
      where: { id: result.userId },
      select: { emailVerifiedAt: true },
    });
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    expect(
      await db.authToken.count({
        where: {
          userId: result.userId,
          purpose: "EMAIL_VERIFICATION",
          usedAt: null,
        },
      }),
    ).toBe(0);

    const messages = await newMailRecords(before);
    const accountExists = messages.filter(
      (message) =>
        message.tag === "account-exists" && message.to === "amina@example.com",
    );
    expect(accountExists).toHaveLength(1);
    const message = accountExists[0];
    expect(message).toBeDefined();
    if (!message) return;

    const appUrl = getAppUrl().replace(/\/+$/, "");
    expect(message.text).toContain(`${appUrl}/login`);
    expect(message.text).toContain(`${appUrl}/forgot-password`);
    expect(message.html).toContain(`${appUrl}/forgot-password`);
  });

  it("does not resend verification for an existing unverified account", async () => {
    const result = await registerAdult();
    expect(
      await db.authToken.count({
        where: {
          userId: result.userId,
          purpose: "EMAIL_VERIFICATION",
          usedAt: null,
        },
      }),
    ).toBe(1);

    const before = new Set(await mailFileNames());
    const duplicate = await registerAccount(adultInput());
    expect(duplicate).toEqual({ ok: false, reason: "email_taken" });

    const user = await db.user.findUniqueOrThrow({
      where: { id: result.userId },
      select: { emailVerifiedAt: true },
    });
    expect(user.emailVerifiedAt).toBeNull();
    expect(
      await db.authToken.count({
        where: {
          userId: result.userId,
          purpose: "EMAIL_VERIFICATION",
          usedAt: null,
        },
      }),
    ).toBe(1);

    const messages = await newMailRecords(before);
    expect(messages.filter((mail) => mail.tag === "verify-email")).toHaveLength(
      0,
    );
    expect(
      messages.filter(
        (mail) =>
          mail.tag === "account-exists" && mail.to === "amina@example.com",
      ),
    ).toHaveLength(1);
  });

  it("does not create duplicate accounts on repeated registration attempts", async () => {
    await registerAdult();

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(registerAccount(adultInput())).resolves.toEqual({
        ok: false,
        reason: "email_taken",
      });
    }

    expect(await db.user.count({ where: { email: "amina@example.com" } })).toBe(
      1,
    );
  });

  it("rejects passwords that contain the account name or email", async () => {
    const result = await registerAccount(
      adultInput({
        password: "Amina-Karimova-2026",
        confirmPassword: "Amina-Karimova-2026",
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("password_rejected");
  });

  it("requires verification for a newly registered unverified adult", async () => {
    const result = await registerAdult();
    const session = await validateSessionToken(result.sessionToken);

    expect(session).not.toBeNull();
    expect(getVerificationRequirement(session!.user)).toEqual({
      state: "required",
      reason: "new_account",
    });
    expect(session!.user.emailVerifiedAt).toBeNull();

    const status = await getWorkspaceStatus(session!.user);
    expect(status.canUseWorkspace).toBe(true);
  });

  it("keeps an existing verified session usable", async () => {
    const result = await registerAdult();
    expect((await verifyEmailToken(result.verificationToken)).ok).toBe(true);

    const session = await validateSessionToken(result.sessionToken);
    expect(session).not.toBeNull();
    expect(getVerificationRequirement(session!.user)).toEqual({
      state: "verified",
    });
  });
});

describe("Google sign-in", () => {
  const identity = {
    subject: "google-subject-123",
    email: "google@example.com",
    name: "Google Student",
  };

  it("creates a verified account with terms and a database session", async () => {
    const result = await completeGoogleSignIn(identity, "SIGN_UP", {
      dateOfBirth: new Date(`${dateYearsAgo(22)}T00:00:00.000Z`),
      termsAcceptedAt: new Date(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.created).toBe(true);
    expect((await validateSessionToken(result.sessionToken))?.user.id).toBe(
      result.userId,
    );
    const user = await db.user.findUniqueOrThrow({
      where: { id: result.userId },
      select: {
        emailVerifiedAt: true,
        passwordHash: true,
        googleAccount: { select: { subject: true } },
        consents: { select: { type: true } },
      },
    });
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    expect(user.passwordHash).toBeNull();
    expect(user.googleAccount?.subject).toBe(identity.subject);
    expect(user.consents.map(({ type }) => type).sort()).toEqual([
      "PRIVACY",
      "TERMS",
    ]);

    const signedIn = await completeGoogleSignIn(identity, "SIGN_IN", null);
    expect(signedIn.ok).toBe(true);
    if (signedIn.ok) expect(signedIn.userId).toBe(result.userId);
  });

  it("links a verified Google identity to an existing email account", async () => {
    const registered = await registerAdult({
      email: identity.email,
    });
    const result = await completeGoogleSignIn(identity, "SIGN_IN", null);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.userId).toBe(registered.userId);
    const linked = await db.googleAccount.findUniqueOrThrow({
      where: { subject: identity.subject },
    });
    expect(linked.userId).toBe(registered.userId);
  });

  it("does not create accounts from sign-in and keeps guardian consent for minors", async () => {
    const unknown = await completeGoogleSignIn(identity, "SIGN_IN", null);
    expect(unknown).toEqual({ ok: false, reason: "account_not_found" });
    const underage = await completeGoogleSignIn(
      { ...identity, email: "underage@example.com" },
      "SIGN_UP",
      {
        dateOfBirth: new Date(`${dateYearsAgo(12)}T00:00:00.000Z`),
        termsAcceptedAt: new Date(),
      },
    );
    expect(underage).toEqual({ ok: false, reason: "invalid_signup" });

    const minorIdentity = {
      subject: "google-minor-subject",
      email: "minor-google@example.com",
      name: "Minor Student",
    };
    const minor = await completeGoogleSignIn(minorIdentity, "SIGN_UP", {
      dateOfBirth: new Date(`${dateYearsAgo(16)}T00:00:00.000Z`),
      termsAcceptedAt: new Date(),
      guardianName: "Guardian Student",
      guardianEmail: "guardian@example.com",
    });

    expect(minor.ok).toBe(true);
    if (!minor.ok) return;
    expect(minor.guardianConsentRequired).toBe(true);
    const session = await validateSessionToken(minor.sessionToken);
    const status = await getWorkspaceStatus(session!.user);
    expect(status.canUseWorkspace).toBe(false);
  });
});

describe("guardian consent", () => {
  it("requires consent for a minor and unlocks the profile after approval", async () => {
    const result = await registerMinor();

    expect(result.minor).toBe(true);
    expect(result.guardianToken).toBeTruthy();
    expect(result.guardianEmail).toBe("guardian@example.com");

    const before = await db.studentProfile.findUniqueOrThrow({
      where: { userId: result.userId },
      select: { guardianName: true, guardianConsentAt: true },
    });
    expect(before.guardianName).toBe("Dilnoza Aliyev");
    expect(before.guardianConsentAt).toBeNull();

    const decision = await recordGuardianDecision(
      result.guardianToken!,
      "approve",
    );
    expect(decision.ok).toBe(true);

    const after = await db.studentProfile.findUniqueOrThrow({
      where: { userId: result.userId },
      select: {
        guardianConsentAt: true,
        guardianConsentVersion: true,
        guardianEmail: true,
      },
    });
    expect(after.guardianConsentAt).toBeInstanceOf(Date);
    expect(after.guardianConsentVersion).toBe(POLICY_VERSION);
    expect(after.guardianEmail).toBe("guardian@example.com");

    const consent = await db.consentRecord.findFirst({
      where: { userId: result.userId, type: "GUARDIAN" },
    });
    expect(consent?.version).toBe(POLICY_VERSION);

    const reused = await recordGuardianDecision(
      result.guardianToken!,
      "approve",
    );
    expect(reused).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("records a declined request without granting consent", async () => {
    const result = await registerMinor();

    const decision = await recordGuardianDecision(
      result.guardianToken!,
      "decline",
    );
    expect(decision).toEqual({
      ok: true,
      decision: "decline",
      studentName: "Timur Aliyev",
    });

    const profile = await db.studentProfile.findUniqueOrThrow({
      where: { userId: result.userId },
      select: { guardianConsentAt: true },
    });
    expect(profile.guardianConsentAt).toBeNull();

    const consent = await db.consentRecord.findFirst({
      where: { userId: result.userId, type: "GUARDIAN" },
    });
    expect(consent).toBeNull();
  });

  it("resends consent to an updated guardian address", async () => {
    const result = await registerMinor();

    const resent = await resendGuardianConsent(
      result.userId,
      {},
      {
        guardianName: "New Guardian",
        guardianEmail: "new-guardian@example.com",
      },
    );
    expect(resent).toEqual({
      ok: true,
      guardianEmail: "new-guardian@example.com",
    });

    const profile = await db.studentProfile.findUniqueOrThrow({
      where: { userId: result.userId },
      select: { guardianName: true, guardianEmail: true },
    });
    expect(profile).toEqual({
      guardianName: "New Guardian",
      guardianEmail: "new-guardian@example.com",
    });

    const token = await db.authToken.findFirst({
      where: {
        userId: result.userId,
        purpose: "GUARDIAN_CONSENT",
        usedAt: null,
      },
      select: { email: true },
    });
    expect(token?.email).toBe("new-guardian@example.com");
  });
});

describe("password reset", () => {
  it("resets the password, revokes sessions, and rejects token reuse", async () => {
    const result = await registerAdult();
    const secondLogin = await authenticate({
      email: "amina@example.com",
      password: PASSWORD,
    });
    expect(secondLogin.ok).toBe(true);

    const reset = await requestPasswordReset("amina@example.com");
    expect(reset.token).toBeTruthy();

    const outcome = await resetPasswordWithToken(
      reset.token!,
      NEW_PASSWORD,
      NEW_PASSWORD,
    );
    expect(outcome.ok).toBe(true);

    const updatedUser = await db.user.findUniqueOrThrow({
      where: { id: result.userId },
      select: { emailVerifiedAt: true },
    });
    expect(updatedUser.emailVerifiedAt).toBeInstanceOf(Date);

    expect(await validateSessionToken(result.sessionToken)).toBeNull();
    if (secondLogin.ok && !secondLogin.mfaRequired) {
      expect(await validateSessionToken(secondLogin.sessionToken)).toBeNull();
    }

    const oldPassword = await authenticate({
      email: "amina@example.com",
      password: PASSWORD,
    });
    expect(oldPassword.ok).toBe(false);

    const newPassword = await authenticate({
      email: "amina@example.com",
      password: NEW_PASSWORD,
    });
    expect(newPassword.ok).toBe(true);

    const reused = await resetPasswordWithToken(
      reset.token!,
      NEW_PASSWORD,
      NEW_PASSWORD,
    );
    expect(reused).toEqual({ ok: false, reason: "invalid_token" });
  });

  it("keeps the token usable when the new password fails policy validation", async () => {
    await registerAdult();

    const reset = await requestPasswordReset("amina@example.com");
    expect(reset.token).toBeTruthy();

    const weak = await resetPasswordWithToken(
      reset.token!,
      WEAK_PASSWORD,
      WEAK_PASSWORD,
    );
    if (weak.ok) throw new Error("expected the weak password to be rejected");
    expect(weak.reason).toBe("password_rejected");
    expect(await findToken(reset.token!, "PASSWORD_RESET")).not.toBeNull();

    const strong = await resetPasswordWithToken(
      reset.token!,
      NEW_PASSWORD,
      NEW_PASSWORD,
    );
    expect(strong.ok).toBe(true);
    expect(await findToken(reset.token!, "PASSWORD_RESET")).toBeNull();
  });

  it("keeps the token usable when password confirmation does not match", async () => {
    await registerAdult();

    const reset = await requestPasswordReset("amina@example.com");
    expect(reset.token).toBeTruthy();

    const mismatch = await resetPasswordWithToken(
      reset.token!,
      NEW_PASSWORD,
      "Another-Strong-Passphrase-43",
    );
    expect(mismatch).toEqual({ ok: false, reason: "password_mismatch" });
    expect(await findToken(reset.token!, "PASSWORD_RESET")).not.toBeNull();

    const strong = await resetPasswordWithToken(
      reset.token!,
      NEW_PASSWORD,
      NEW_PASSWORD,
    );
    expect(strong.ok).toBe(true);
  });

  it("rejects expired reset tokens", async () => {
    const result = await registerAdult();

    const reset = await requestPasswordReset("amina@example.com");
    expect(reset.token).toBeTruthy();

    const tokenRecord = await db.authToken.findFirst({
      where: {
        userId: result.userId,
        purpose: "PASSWORD_RESET",
        usedAt: null,
      },
      select: { id: true },
    });
    expect(tokenRecord).not.toBeNull();

    await db.authToken.update({
      where: { id: tokenRecord!.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });

    await expect(
      resetPasswordWithToken(reset.token!, NEW_PASSWORD, NEW_PASSWORD),
    ).resolves.toEqual({ ok: false, reason: "invalid_token" });
  });

  it("allows only one concurrent request to consume a reset token", async () => {
    await registerAdult();

    const reset = await requestPasswordReset("amina@example.com");
    expect(reset.token).toBeTruthy();

    const results = await Promise.all([
      resetPasswordWithToken(reset.token!, NEW_PASSWORD, NEW_PASSWORD),
      resetPasswordWithToken(reset.token!, NEW_PASSWORD, NEW_PASSWORD),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(
      results.filter(
        (result) => !result.ok && result.reason === "invalid_token",
      ),
    ).toHaveLength(1);
    expect(await findToken(reset.token!, "PASSWORD_RESET")).toBeNull();
  });

  it("returns no token and creates no reset side effects for an unknown address", async () => {
    const before = new Set(await mailFileNames());

    const result = await requestPasswordReset("nobody@example.com");
    expect(result.token).toBeNull();
    expect(await db.authToken.count()).toBe(0);
    expect(await db.auditEvent.count()).toBe(0);

    const messages = await newMailRecords(before);
    expect(
      messages.filter((message) => message.to === "nobody@example.com"),
    ).toHaveLength(0);
  });
});

describe("student profile", () => {
  it("saves study preferences and marks onboarding complete", async () => {
    const result = await registerAdult();

    const outcome = await updateProfile(result.userId, profileInput());
    expect(outcome).toEqual({ ok: true, profileComplete: true });

    const profile = await db.studentProfile.findUniqueOrThrow({
      where: { userId: result.userId },
    });
    expect(profile.nationality).toBe("UZ");
    expect(profile.targetDegree).toBe("MASTER");
    expect(profile.fieldsOfStudy).toEqual(["Computer Science", "Engineering"]);
    expect(profile.budgetAmount).toBe(12_000);
    expect(profile.budgetCurrency).toBe("USD");
    expect(profile.onboardingCompletedAt).toBeInstanceOf(Date);

    const user = await db.user.findUniqueOrThrow({
      where: { id: result.userId },
      select: { name: true },
    });
    expect(user.name).toBe("Amina Karimova");
  });

  it("refuses to write a profile for a missing account", async () => {
    const outcome = await updateProfile("missing-user-id", profileInput());
    expect(outcome).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("account security", () => {
  it("changes the password and keeps only the current session", async () => {
    const result = await registerAdult();
    const otherLogin = await authenticate({
      email: "amina@example.com",
      password: PASSWORD,
    });
    expect(otherLogin.ok).toBe(true);

    const current = await validateSessionToken(result.sessionToken);
    expect(current).not.toBeNull();

    const outcome = await changePassword(
      result.userId,
      PASSWORD,
      NEW_PASSWORD,
      current!.session.id,
    );
    expect(outcome.ok).toBe(true);

    expect(await validateSessionToken(result.sessionToken)).not.toBeNull();
    if (otherLogin.ok && !otherLogin.mfaRequired) {
      expect(await validateSessionToken(otherLogin.sessionToken)).toBeNull();
    }
  });

  it("refuses to change the password with the wrong current password", async () => {
    const result = await registerAdult();
    const current = await validateSessionToken(result.sessionToken);

    const outcome = await changePassword(
      result.userId,
      "Wrong-Current-Password-1",
      NEW_PASSWORD,
      current!.session.id,
    );
    expect(outcome).toEqual({ ok: false, reason: "wrong_password" });
  });

  it("soft-deletes the account and scrubs personal data", async () => {
    const result = await registerAdult();
    await updateProfile(result.userId, profileInput());

    const universitySource = await db.sourceCitation.create({
      data: {
        url: "https://www.example.edu/",
        publisher: "Example University",
        title: "Official university page",
        accessedAt: new Date("2026-11-12"),
      },
    });
    const university = await db.university.create({
      data: {
        slug: "example-university",
        name: "Example University",
        city: "Berlin",
        countryCode: "DE",
        websiteUrl: "https://www.example.edu/",
        primarySourceId: universitySource.id,
      },
    });
    await db.universityFavorite.create({
      data: { userId: result.userId, universityId: university.id },
    });

    const scholarshipSource = await db.sourceCitation.create({
      data: {
        url: "https://www.example.org/scholarship",
        publisher: "Example Foundation",
        title: "Scholarship rules",
        accessedAt: new Date("2026-11-12"),
      },
    });
    const scholarship = await db.scholarship.create({
      data: {
        slug: "example-scholarship",
        name: "Example Scholarship",
        providerName: "Example Foundation",
        providerUrl: "https://www.example.org/",
        fundingType: "FULLY_FUNDED",
        degreeLevels: ["MASTER"],
        summary: "A scholarship for verified integration test coverage.",
        primarySourceId: scholarshipSource.id,
      },
    });
    await db.scholarshipFavorite.create({
      data: { userId: result.userId, scholarshipId: scholarship.id },
    });

    const outcome = await deleteAccount(result.userId, PASSWORD);
    expect(outcome).toEqual({ ok: true });

    const user = await db.user.findUniqueOrThrow({
      where: { id: result.userId },
      select: {
        email: true,
        name: true,
        passwordHash: true,
        dateOfBirth: true,
        emailVerifiedAt: true,
        deletedAt: true,
      },
    });
    expect(user.email).toBe(`deleted+${result.userId}@edubridge.invalid`);
    expect(user.name).toBe("Deleted account");
    expect(user.passwordHash).toBeNull();
    expect(user.dateOfBirth).toBeNull();
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.deletedAt).toBeInstanceOf(Date);

    expect(
      await db.studentProfile.count({ where: { userId: result.userId } }),
    ).toBe(0);
    expect(
      await db.universityFavorite.count({ where: { userId: result.userId } }),
    ).toBe(0);
    expect(
      await db.scholarshipFavorite.count({ where: { userId: result.userId } }),
    ).toBe(0);
    expect(await db.authToken.count({ where: { userId: result.userId } })).toBe(
      0,
    );
    expect(
      await db.session.count({
        where: { userId: result.userId, revokedAt: null },
      }),
    ).toBe(0);
    expect(await validateSessionToken(result.sessionToken)).toBeNull();

    const login = await authenticate({
      email: "amina@example.com",
      password: PASSWORD,
    });
    expect(login.ok).toBe(false);
  });

  it("refuses to delete an account with the wrong password", async () => {
    const result = await registerAdult();
    const outcome = await deleteAccount(result.userId, "Wrong-Password-123");
    expect(outcome).toEqual({ ok: false, reason: "wrong_password" });
  });
});

describe("rate limiting", () => {
  it("allows up to the limit, then denies, per identifier", async () => {
    const options = {
      scope: "test.login",
      identifier: "student@example.com",
      limit: 2,
      windowSeconds: 60,
    };

    expect((await rateLimit(options)).allowed).toBe(true);
    expect((await rateLimit(options)).allowed).toBe(true);

    const denied = await rateLimit(options);
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);

    const otherIdentifier = await rateLimit({
      ...options,
      identifier: "other@example.com",
    });
    expect(otherIdentifier.allowed).toBe(true);
  });

  it("hashes identifiers before storing them", async () => {
    const key = rateLimitKey("test.login", "student@example.com");
    expect(key).not.toContain("student@example.com");
    expect(key.startsWith("test.login:")).toBe(true);
    expect(rateLimitKey("test.login", "student@example.com")).toBe(key);

    await rateLimit({
      scope: "test.login",
      identifier: "student@example.com",
      limit: 5,
      windowSeconds: 60,
    });

    const row = await db.rateLimitCounter.findUnique({ where: { key } });
    expect(row).not.toBeNull();
  });
});
