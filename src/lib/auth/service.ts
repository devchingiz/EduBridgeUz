import "server-only";

import type { DegreeLevel } from "@prisma/client";

import { db } from "@/lib/db";
import { removePrivateDocument } from "@/lib/workspace/storage";
import { NAME_MAX_LENGTH, POLICY_VERSION } from "@/lib/auth/constants";
import { evaluateAgeGate, isAdult, parseDateOfBirth } from "@/lib/auth/age";
import { createSession, revokeAllSessions } from "@/lib/auth/session";
import {
  consumeToken,
  findToken,
  issueToken,
  TOKEN_TTL,
} from "@/lib/auth/tokens";
import { recordAuditEvent } from "@/lib/auth/audit";
import { promoteBootstrapAdmin } from "@/lib/auth/bootstrap-admin";
import { issueMfaChallenge } from "@/lib/auth/mfa";
import { getAppUrl } from "@/lib/env";
import { EMAIL_SEND_MAX_ATTEMPTS, sendMail } from "@/lib/email/mailer";
import { logError, logWarn } from "@/lib/observability/logger";
import {
  accountExistsEmail,
  guardianConsentEmail,
  passwordChangedEmail,
  passwordResetEmail,
  verificationEmail,
} from "@/lib/email/templates";
import {
  checkPassword,
  consumeDummyVerification,
  enforceBreachedPasswordPolicy,
  hashPassword,
  verifyPassword,
} from "@/lib/security/password";
import { hashIdentifier, hashToken } from "@/lib/security/crypto";
import {
  parseBudgetAmount,
  type ProfileInput,
  type RegisterInput,
} from "@/lib/validation/auth";

/**
 * Authentication and profile use cases.
 *
 * This module deliberately does not import `next/headers` or `next/navigation`
 * so every flow can be exercised by integration tests without a request
 * context. Server Actions handle cookies, rate limits, and redirects; this layer
 * owns the security-relevant state transitions.
 */

export type ServiceContext = {
  ip?: string;
  userAgent?: string | null;
  documentCleanup?: (storageKey: string) => Promise<void>;
};

function appUrl(path: string): string {
  return `${getAppUrl().replace(/\/+$/, "")}${path}`;
}

function ipHash(context: ServiceContext): string | null {
  return context.ip && context.ip !== "unknown"
    ? hashIdentifier(context.ip)
    : null;
}

async function sendSafely(
  message: Parameters<typeof sendMail>[0],
): Promise<void> {
  try {
    await sendMail(message);
  } catch (error) {
    // A delivery outage must not roll back an account that was created
    // correctly. The user can request another link from the verify screen.
    logError("email.delivery_failed", error, {
      tag: message.tag,
      attempt: EMAIL_SEND_MAX_ATTEMPTS,
    });
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export type RegistrationOutcome =
  | {
      ok: true;
      userId: string;
      name: string;
      email: string;
      sessionToken: string;
      /** @internal returned for tests; never serialized to a client. */
      verificationToken: string;
      /** @internal returned for tests; never serialized to a client. */
      guardianToken: string | null;
      guardianEmail: string | null;
      minor: boolean;
    }
  | { ok: false; reason: "email_taken" }
  | { ok: false; reason: "password_rejected"; errors: string[] };

export async function registerAccount(
  input: RegisterInput,
  context: ServiceContext = {},
): Promise<RegistrationOutcome> {
  const policy = checkPassword(input.password, {
    email: input.email,
    name: input.name,
  });
  if (!policy.ok) {
    return { ok: false, reason: "password_rejected", errors: policy.errors };
  }

  const dateOfBirth = parseDateOfBirth(input.dateOfBirth);
  if (!dateOfBirth) {
    return {
      ok: false,
      reason: "password_rejected",
      errors: ["Enter a valid date of birth."],
    };
  }

  const gate = evaluateAgeGate(dateOfBirth);
  if (gate.status === "too_young" || gate.status === "invalid") {
    return {
      ok: false,
      reason: "password_rejected",
      errors: ["This account cannot be created with that date of birth."],
    };
  }

  const breachPolicy = await enforceBreachedPasswordPolicy(input.password);
  if (!breachPolicy.ok) {
    return {
      ok: false,
      reason: "password_rejected",
      errors: breachPolicy.errors,
    };
  }

  // Hash before the existence lookup so both new and existing addresses pay
  // the same dominant cost. The unique email constraint still prevents a
  // concurrent request from creating a duplicate account.
  const passwordHash = await hashPassword(input.password);

  const existing = await db.user.findUnique({
    where: { email: input.email },
    select: { id: true, name: true },
  });

  if (existing) {
    const template = accountExistsEmail({
      name: existing.name,
      signInUrl: appUrl("/login"),
      resetUrl: appUrl("/forgot-password"),
    });
    await sendSafely({
      to: input.email,
      tag: "account-exists",
      ...template,
    });
    return { ok: false, reason: "email_taken" };
  }

  const minor = gate.status === "minor";
  const guardianName = minor ? (input.guardianName?.trim() ?? null) : null;
  const guardianEmail = minor
    ? (input.guardianEmail?.trim().toLowerCase() ?? null)
    : null;

  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
        dateOfBirth,
      },
      select: { id: true, name: true, email: true },
    });

    await tx.studentProfile.create({
      data: {
        userId: created.id,
        guardianName,
        guardianEmail,
      },
    });

    await tx.consentRecord.createMany({
      data: [
        {
          userId: created.id,
          type: "TERMS",
          version: POLICY_VERSION,
          ipHash: ipHash(context),
        },
        {
          userId: created.id,
          type: "PRIVACY",
          version: POLICY_VERSION,
          ipHash: ipHash(context),
        },
      ],
    });

    return created;
  });

  const verification = await issueToken({
    userId: user.id,
    purpose: "EMAIL_VERIFICATION",
  });

  let guardianToken: string | null = null;
  if (minor && guardianEmail) {
    const issued = await issueToken({
      userId: user.id,
      purpose: "GUARDIAN_CONSENT",
      email: guardianEmail,
      ttlMs: TOKEN_TTL.GUARDIAN_CONSENT,
    });
    guardianToken = issued.token;
  }

  await promoteBootstrapAdmin(user.id, user.email, context);

  const session = await createSession(user.id, context);

  const verificationTemplate = verificationEmail({
    name: user.name,
    url: appUrl(
      `/verify-email?token=${encodeURIComponent(verification.token)}`,
    ),
  });
  await sendSafely({
    to: user.email,
    tag: "verify-email",
    ...verificationTemplate,
  });

  if (guardianToken && guardianEmail && guardianName) {
    const guardianTemplate = guardianConsentEmail({
      guardianName,
      studentName: user.name,
      url: appUrl(`/guardian-consent/${guardianToken}`),
    });
    await sendSafely({
      to: guardianEmail,
      tag: "guardian-consent",
      ...guardianTemplate,
    });
  }

  await recordAuditEvent({
    actorId: user.id,
    action: "auth.register",
    entityType: "User",
    entityId: user.id,
    metadata: { minor, guardianRequired: minor },
    ip: context.ip,
  });

  return {
    ok: true,
    userId: user.id,
    name: user.name,
    email: user.email,
    sessionToken: session.token,
    verificationToken: verification.token,
    guardianToken,
    guardianEmail,
    minor,
  };
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export type LoginOutcome =
  | {
      ok: true;
      sessionToken: string;
      userId: string;
      emailVerifiedAt: Date | null;
      createdAt: Date;
      mfaRequired?: false;
    }
  | {
      ok: true;
      mfaRequired: true;
      mfaChallengeToken: string;
      userId: string;
      emailVerifiedAt: Date | null;
      createdAt: Date;
    }
  | { ok: false };

export async function authenticate(
  input: { email: string; password: string },
  context: ServiceContext = {},
): Promise<LoginOutcome> {
  const user = await db.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      deletedAt: true,
      emailVerifiedAt: true,
      createdAt: true,
      mfaEnabledAt: true,
      mfaSecret: true,
    },
  });

  if (!user || user.deletedAt || !user.passwordHash) {
    // Equalise the timing of unknown-email and wrong-password responses.
    await consumeDummyVerification();
    logWarn("auth.login_failed", { reason: "credentials" });
    return { ok: false };
  }

  const valid = await verifyPassword(user.passwordHash, input.password);
  if (!valid) {
    logWarn("auth.login_failed", { reason: "credentials" });
    return { ok: false };
  }

  await promoteBootstrapAdmin(user.id, user.email, context);

  // A password alone never creates a session for an enrolled account. The
  // challenge is single-use and short-lived; the second factor completes login.
  if (user.mfaEnabledAt && user.mfaSecret) {
    const mfaChallengeToken = await issueMfaChallenge(user.id);
    return {
      ok: true,
      mfaRequired: true,
      mfaChallengeToken,
      userId: user.id,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
    };
  }

  const session = await createSession(user.id, context);

  await recordAuditEvent({
    actorId: user.id,
    action: "auth.login",
    entityType: "Session",
    entityId: session.sessionId,
    ip: context.ip,
  });

  return {
    ok: true,
    sessionToken: session.token,
    userId: user.id,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
  };
}

/**
 * Creates the real session only after a valid second factor. The caller must
 * have already verified the single-use MFA challenge for this user.
 */
export async function completeMfaLogin(
  userId: string,
  context: ServiceContext = {},
): Promise<{
  sessionToken: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
} | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { emailVerifiedAt: true, createdAt: true, deletedAt: true },
  });
  if (!user || user.deletedAt) return null;

  const session = await createSession(userId, context);
  await recordAuditEvent({
    actorId: userId,
    action: "auth.login",
    entityType: "Session",
    entityId: session.sessionId,
    ip: context.ip,
  });

  return {
    sessionToken: session.token,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
  };
}

export type GoogleIdentity = {
  subject: string;
  email: string;
  name?: string;
};

export type GoogleSignUpDetails = {
  dateOfBirth: Date;
  termsAcceptedAt: Date;
  guardianName?: string | null;
  guardianEmail?: string | null;
};

export type GoogleSignInOutcome =
  | {
      ok: true;
      userId: string;
      sessionToken: string;
      created: boolean;
      guardianConsentRequired: boolean;
    }
  | { ok: false; reason: "account_not_found" | "invalid_signup" };

/**
 * Links a verified Google identity to an existing account or creates a new
 * account after the registration form has collected age and terms consent.
 */
export async function completeGoogleSignIn(
  identity: GoogleIdentity,
  intent: "SIGN_IN" | "SIGN_UP",
  details: GoogleSignUpDetails | null,
  context: ServiceContext = {},
): Promise<GoogleSignInOutcome> {
  if (
    !identity.subject ||
    !identity.email ||
    (intent === "SIGN_UP" && !details)
  ) {
    return { ok: false, reason: "invalid_signup" };
  }

  const connected = await db.googleAccount.findUnique({
    where: { subject: identity.subject },
    select: {
      user: {
        select: {
          id: true,
          email: true,
          deletedAt: true,
          dateOfBirth: true,
          profile: { select: { guardianConsentAt: true } },
        },
      },
    },
  });

  if (connected) {
    if (connected.user.deletedAt) {
      return { ok: false, reason: "account_not_found" };
    }
    await promoteBootstrapAdmin(
      connected.user.id,
      connected.user.email,
      context,
    );
    const session = await createSession(connected.user.id, context);
    await recordAuditEvent({
      actorId: connected.user.id,
      action: "auth.google_login",
      entityType: "Session",
      entityId: session.sessionId,
      metadata: { linked: false },
      ip: context.ip,
    });
    const minor = connected.user.dateOfBirth
      ? !isAdult(connected.user.dateOfBirth)
      : false;
    return {
      ok: true,
      userId: connected.user.id,
      sessionToken: session.token,
      created: false,
      guardianConsentRequired:
        minor && !connected.user.profile?.guardianConsentAt,
    };
  }

  const existing = await db.user.findUnique({
    where: { email: identity.email },
    select: {
      id: true,
      name: true,
      deletedAt: true,
      emailVerifiedAt: true,
      dateOfBirth: true,
      profile: { select: { guardianConsentAt: true } },
      googleAccount: { select: { subject: true } },
    },
  });

  if (existing?.deletedAt || (!existing && intent === "SIGN_IN")) {
    return { ok: false, reason: "account_not_found" };
  }

  if (existing) {
    if (
      existing.googleAccount &&
      existing.googleAccount.subject !== identity.subject
    ) {
      return { ok: false, reason: "account_not_found" };
    }
    await db.$transaction(async (tx) => {
      if (!existing.googleAccount) {
        await tx.googleAccount.create({
          data: { subject: identity.subject, userId: existing.id },
        });
      }
      if (!existing.emailVerifiedAt) {
        await tx.user.update({
          where: { id: existing.id },
          data: { emailVerifiedAt: new Date() },
        });
      }
    });
    await promoteBootstrapAdmin(existing.id, identity.email, context);
    const session = await createSession(existing.id, context);
    await recordAuditEvent({
      actorId: existing.id,
      action: "auth.google_login",
      entityType: "Session",
      entityId: session.sessionId,
      metadata: { linked: !existing.googleAccount },
      ip: context.ip,
    });
    const minor = existing.dateOfBirth ? !isAdult(existing.dateOfBirth) : false;
    return {
      ok: true,
      userId: existing.id,
      sessionToken: session.token,
      created: false,
      guardianConsentRequired: minor && !existing.profile?.guardianConsentAt,
    };
  }

  const dateOfBirth = details?.dateOfBirth;
  if (!details || !dateOfBirth || !details.termsAcceptedAt) {
    return { ok: false, reason: "invalid_signup" };
  }
  const ageGate = evaluateAgeGate(dateOfBirth);
  if (ageGate.status === "invalid" || ageGate.status === "too_young") {
    return { ok: false, reason: "invalid_signup" };
  }
  const guardianName =
    ageGate.status === "minor" ? details.guardianName?.trim() : null;
  const guardianEmail =
    ageGate.status === "minor"
      ? details.guardianEmail?.trim().toLowerCase()
      : null;
  if (
    ageGate.status === "minor" &&
    (!guardianName ||
      guardianName.length < 2 ||
      !guardianEmail ||
      guardianEmail === identity.email)
  ) {
    return { ok: false, reason: "invalid_signup" };
  }

  const name =
    identity.name?.trim().slice(0, NAME_MAX_LENGTH) ||
    identity.email.split("@")[0];
  const now = new Date();
  const user = await db.user.create({
    data: {
      email: identity.email,
      name,
      emailVerifiedAt: now,
      dateOfBirth,
      googleAccount: { create: { subject: identity.subject } },
      profile: { create: { guardianName, guardianEmail } },
      consents: {
        create: [
          {
            type: "TERMS",
            version: POLICY_VERSION,
            grantedAt: details.termsAcceptedAt,
            ipHash: ipHash(context),
          },
          {
            type: "PRIVACY",
            version: POLICY_VERSION,
            grantedAt: details.termsAcceptedAt,
            ipHash: ipHash(context),
          },
        ],
      },
    },
    select: { id: true },
  });

  let guardianConsentRequired = ageGate.status === "minor";
  if (guardianConsentRequired && guardianEmail && guardianName) {
    const issued = await issueToken({
      userId: user.id,
      purpose: "GUARDIAN_CONSENT",
      email: guardianEmail,
      ttlMs: TOKEN_TTL.GUARDIAN_CONSENT,
    });
    const template = guardianConsentEmail({
      guardianName,
      studentName: name,
      url: appUrl(`/guardian-consent/${issued.token}`),
    });
    await sendSafely({
      to: guardianEmail,
      tag: "guardian-consent",
      ...template,
    });
  } else {
    guardianConsentRequired = false;
  }

  await promoteBootstrapAdmin(user.id, identity.email, context);

  const session = await createSession(user.id, context);
  await recordAuditEvent({
    actorId: user.id,
    action: "auth.google_register",
    entityType: "User",
    entityId: user.id,
    metadata: { minor: guardianConsentRequired },
    ip: context.ip,
  });

  return {
    ok: true,
    userId: user.id,
    sessionToken: session.token,
    created: true,
    guardianConsentRequired,
  };
}

// ---------------------------------------------------------------------------
// Email verification
// ---------------------------------------------------------------------------

export async function verifyEmailToken(
  token: string,
  context: ServiceContext = {},
): Promise<
  { ok: true; userId: string; name: string; email: string } | { ok: false }
> {
  const record = await consumeToken(token, "EMAIL_VERIFICATION");
  if (!record) return { ok: false };

  await db.user.update({
    where: { id: record.userId },
    data: {
      emailVerifiedAt: record.user.emailVerifiedAt ?? new Date(),
      email: record.email ?? record.user.email,
    },
  });

  await recordAuditEvent({
    actorId: record.userId,
    action: "auth.email_verified",
    entityType: "User",
    entityId: record.userId,
    ip: context.ip,
  });

  return {
    ok: true,
    userId: record.userId,
    name: record.user.name,
    email: record.email ?? record.user.email,
  };
}

export async function resendVerificationEmail(
  userId: string,
  context: ServiceContext = {},
): Promise<{ ok: true; alreadyVerified: boolean } | { ok: false }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerifiedAt: true,
      deletedAt: true,
    },
  });

  if (!user || user.deletedAt) return { ok: false };
  if (user.emailVerifiedAt) return { ok: true, alreadyVerified: true };

  const issued = await issueToken({
    userId: user.id,
    purpose: "EMAIL_VERIFICATION",
  });

  const template = verificationEmail({
    name: user.name,
    url: appUrl(`/verify-email?token=${encodeURIComponent(issued.token)}`),
  });
  await sendSafely({ to: user.email, tag: "verify-email", ...template });

  await recordAuditEvent({
    actorId: user.id,
    action: "auth.verification_resent",
    entityType: "User",
    entityId: user.id,
    ip: context.ip,
  });

  return { ok: true, alreadyVerified: false };
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

/**
 * Balances local work for unknown or deleted reset addresses. Sign-in can use
 * dummy Argon2 verification because it compares passwords; reset requests do
 * no password verification, so that would be misleading here. This mirrors
 * token hashing and email-template rendering without writing an AuthToken or
 * sending mail. Database writes and SMTP latency remain unmatched, so this
 * reduces but does not eliminate timing differences.
 */
function performUnavailableAccountResetWork(): void {
  hashToken("edubridge-password-reset-timing-equalizer");
  const template = passwordResetEmail({
    name: "EduBridge user",
    url: appUrl("/reset-password"),
  });
  void template.subject;
  void template.text;
  void template.html;
}

export async function requestPasswordReset(
  email: string,
  context: ServiceContext = {},
): Promise<{ token: string | null }> {
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, deletedAt: true },
  });

  if (!user || user.deletedAt) {
    performUnavailableAccountResetWork();
    return { token: null };
  }

  const issued = await issueToken({
    userId: user.id,
    purpose: "PASSWORD_RESET",
    email: user.email,
  });

  const template = passwordResetEmail({
    name: user.name,
    url: appUrl(`/reset-password?token=${encodeURIComponent(issued.token)}`),
  });
  await sendSafely({ to: user.email, tag: "password-reset", ...template });

  await recordAuditEvent({
    actorId: user.id,
    action: "auth.password_reset_requested",
    entityType: "User",
    entityId: user.id,
    ip: context.ip,
  });

  return { token: issued.token };
}

export type PasswordResetOutcome =
  | { ok: true; name: string; email: string }
  | {
      ok: false;
      reason: "invalid_token" | "password_mismatch" | "password_rejected";
      errors?: string[];
    };

export async function resetPasswordWithToken(
  token: string,
  password: string,
  confirmPassword: string,
  context: ServiceContext = {},
): Promise<PasswordResetOutcome> {
  const record = await findToken(token, "PASSWORD_RESET");
  if (!record) return { ok: false, reason: "invalid_token" };

  if (password !== confirmPassword) {
    return { ok: false, reason: "password_mismatch" };
  }

  const policy = checkPassword(password, {
    email: record.user.email,
    name: record.user.name,
  });
  if (!policy.ok) {
    return { ok: false, reason: "password_rejected", errors: policy.errors };
  }

  // Check before consuming the token so a rejected password can be retried.
  const breachPolicy = await enforceBreachedPasswordPolicy(password);
  if (!breachPolicy.ok) {
    return {
      ok: false,
      reason: "password_rejected",
      errors: breachPolicy.errors,
    };
  }

  const consumed = await consumeToken(token, "PASSWORD_RESET");
  if (!consumed) return { ok: false, reason: "invalid_token" };

  const passwordHash = await hashPassword(password);

  await db.user.update({
    where: { id: consumed.userId },
    data: {
      passwordHash,
      emailVerifiedAt: consumed.user.emailVerifiedAt ?? new Date(),
    },
  });

  await revokeAllSessions(consumed.userId);

  const template = passwordChangedEmail({
    name: consumed.user.name,
    url: appUrl("/login"),
  });
  await sendSafely({
    to: consumed.user.email,
    tag: "password-changed",
    ...template,
  });

  await recordAuditEvent({
    actorId: consumed.userId,
    action: "auth.password_reset",
    entityType: "User",
    entityId: consumed.userId,
    ip: context.ip,
  });

  return { ok: true, name: consumed.user.name, email: consumed.user.email };
}

// ---------------------------------------------------------------------------
// Guardian consent
// ---------------------------------------------------------------------------

export type GuardianDecisionOutcome =
  | { ok: true; decision: "approve" | "decline"; studentName: string }
  | { ok: false; reason: "invalid_token" };

/** Re-sends the guardian request to the address currently on the profile. */
export async function resendGuardianConsent(
  userId: string,
  context: ServiceContext = {},
  contact?: { guardianName: string; guardianEmail: string },
): Promise<
  | { ok: true; guardianEmail: string }
  | { ok: false; reason: "not_found" | "not_required" | "missing_guardian" }
> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, deletedAt: true },
  });
  if (!user || user.deletedAt) return { ok: false, reason: "not_found" };

  const profile = await db.studentProfile.findUnique({
    where: { userId },
    select: {
      guardianName: true,
      guardianEmail: true,
      guardianConsentAt: true,
    },
  });

  if (profile?.guardianConsentAt) return { ok: false, reason: "not_required" };

  const guardianName = contact?.guardianName ?? profile?.guardianName;
  const guardianEmail = contact?.guardianEmail ?? profile?.guardianEmail;

  if (!guardianName || !guardianEmail) {
    return { ok: false, reason: "missing_guardian" };
  }

  if (contact) {
    await db.studentProfile.upsert({
      where: { userId },
      create: {
        userId,
        guardianName: contact.guardianName,
        guardianEmail: contact.guardianEmail,
      },
      update: {
        guardianName: contact.guardianName,
        guardianEmail: contact.guardianEmail,
      },
    });
  }

  const issued = await issueToken({
    userId,
    purpose: "GUARDIAN_CONSENT",
    email: guardianEmail,
    ttlMs: TOKEN_TTL.GUARDIAN_CONSENT,
  });

  const template = guardianConsentEmail({
    guardianName,
    studentName: user.name,
    url: appUrl(`/guardian-consent/${issued.token}`),
  });
  await sendSafely({
    to: guardianEmail,
    tag: "guardian-consent",
    ...template,
  });

  await recordAuditEvent({
    actorId: userId,
    action: "guardian.consent_resent",
    entityType: "StudentProfile",
    entityId: userId,
    ip: context.ip,
  });

  return { ok: true, guardianEmail };
}

export async function recordGuardianDecision(
  token: string,
  decision: "approve" | "decline",
  context: ServiceContext = {},
): Promise<GuardianDecisionOutcome> {
  const record = await consumeToken(token, "GUARDIAN_CONSENT");
  if (!record) return { ok: false, reason: "invalid_token" };

  if (decision === "approve") {
    const profile = await db.studentProfile.findUnique({
      where: { userId: record.userId },
      select: { guardianName: true },
    });

    await db.$transaction(async (tx) => {
      await tx.studentProfile.upsert({
        where: { userId: record.userId },
        create: {
          userId: record.userId,
          guardianName: profile?.guardianName ?? null,
          guardianEmail: record.email,
          guardianConsentAt: new Date(),
          guardianConsentVersion: POLICY_VERSION,
        },
        update: {
          guardianConsentAt: new Date(),
          guardianConsentVersion: POLICY_VERSION,
          guardianEmail: record.email ?? undefined,
        },
      });

      await tx.consentRecord.create({
        data: {
          userId: record.userId,
          type: "GUARDIAN",
          version: POLICY_VERSION,
          ipHash: ipHash(context),
        },
      });
    });
  }

  await recordAuditEvent({
    actorId: record.userId,
    action:
      decision === "approve"
        ? "guardian.consent_granted"
        : "guardian.consent_declined",
    entityType: "StudentProfile",
    entityId: record.userId,
    metadata: {
      guardianEmailHash: record.email
        ? hashIdentifier(record.email).slice(0, 16)
        : null,
    },
    ip: context.ip,
  });

  return { ok: true, decision, studentName: record.user.name };
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export type ProfileOutcome =
  { ok: true; profileComplete: boolean } | { ok: false; reason: "not_found" };

export async function updateProfile(
  userId: string,
  input: ProfileInput,
  context: ServiceContext = {},
): Promise<ProfileOutcome> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, deletedAt: true },
  });
  if (!user || user.deletedAt) return { ok: false, reason: "not_found" };

  const fieldsOfStudy = input.fieldsOfStudy ?? [];
  const budgetAmount = parseBudgetAmount(input.budgetAmount);
  const profileComplete = Boolean(
    input.nationality &&
    input.residenceCountry &&
    input.targetDegree &&
    fieldsOfStudy.length > 0,
  );

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { name: input.name },
    });

    await tx.studentProfile.upsert({
      where: { userId },
      create: {
        userId,
        nationality: input.nationality || null,
        residenceCountry: input.residenceCountry || null,
        currentDegree: (input.currentDegree || null) as DegreeLevel | null,
        targetDegree: (input.targetDegree || null) as DegreeLevel | null,
        fieldsOfStudy,
        englishTest: input.englishTest || null,
        englishScore: input.englishScore,
        budgetAmount,
        budgetCurrency: input.budgetCurrency || null,
        guardianName: input.guardianName,
        guardianEmail: input.guardianEmail,
        onboardingCompletedAt: profileComplete ? new Date() : null,
      },
      update: {
        nationality: input.nationality || null,
        residenceCountry: input.residenceCountry || null,
        currentDegree: (input.currentDegree || null) as DegreeLevel | null,
        targetDegree: (input.targetDegree || null) as DegreeLevel | null,
        fieldsOfStudy,
        englishTest: input.englishTest || null,
        englishScore: input.englishScore,
        budgetAmount,
        budgetCurrency: input.budgetCurrency || null,
        guardianName: input.guardianName,
        guardianEmail: input.guardianEmail,
        ...(profileComplete ? { onboardingCompletedAt: new Date() } : {}),
      },
    });
  });

  await recordAuditEvent({
    actorId: userId,
    action: "profile.updated",
    entityType: "StudentProfile",
    entityId: userId,
    metadata: { profileComplete },
    ip: context.ip,
  });

  return { ok: true, profileComplete };
}

// ---------------------------------------------------------------------------
// Account security
// ---------------------------------------------------------------------------

export type ChangePasswordOutcome =
  | { ok: true }
  | {
      ok: false;
      reason: "wrong_password" | "password_rejected";
      errors?: string[];
    };

export async function changePassword(
  userId: string,
  currentPassword: string,
  nextPassword: string,
  currentSessionId: string,
  context: ServiceContext = {},
): Promise<ChangePasswordOutcome> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
      deletedAt: true,
    },
  });

  if (!user || user.deletedAt || !user.passwordHash) {
    return { ok: false, reason: "wrong_password" };
  }

  const valid = await verifyPassword(user.passwordHash, currentPassword);
  if (!valid) return { ok: false, reason: "wrong_password" };

  const policy = checkPassword(nextPassword, {
    email: user.email,
    name: user.name,
  });
  if (!policy.ok) {
    return { ok: false, reason: "password_rejected", errors: policy.errors };
  }

  const breachPolicy = await enforceBreachedPasswordPolicy(nextPassword);
  if (!breachPolicy.ok) {
    return {
      ok: false,
      reason: "password_rejected",
      errors: breachPolicy.errors,
    };
  }

  const passwordHash = await hashPassword(nextPassword);

  await db.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  await revokeAllSessions(userId, currentSessionId);

  const template = passwordChangedEmail({
    name: user.name,
    url: appUrl("/login"),
  });
  await sendSafely({ to: user.email, tag: "password-changed", ...template });

  await recordAuditEvent({
    actorId: userId,
    action: "auth.password_changed",
    entityType: "User",
    entityId: userId,
    ip: context.ip,
  });

  return { ok: true };
}

export async function deleteAccount(
  userId: string,
  password: string,
  context: ServiceContext = {},
): Promise<{ ok: true } | { ok: false; reason: "wrong_password" }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true, deletedAt: true },
  });

  if (!user || user.deletedAt || !user.passwordHash) {
    return { ok: false, reason: "wrong_password" };
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) return { ok: false, reason: "wrong_password" };

  const documentKeys = await db.studentDocument.findMany({
    where: { userId },
    select: { storageKey: true },
  });

  await Promise.all(
    documentKeys.map(({ storageKey }) =>
      (context.documentCleanup ?? removePrivateDocument)(storageKey),
    ),
  );

  await db.$transaction(async (tx) => {
    await tx.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.authToken.deleteMany({ where: { userId } });
    await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
    await tx.googleAccount.deleteMany({ where: { userId } });
    await tx.consentRecord.deleteMany({ where: { userId } });
    await tx.universityFavorite.deleteMany({ where: { userId } });
    await tx.scholarshipFavorite.deleteMany({ where: { userId } });
    await tx.application.deleteMany({ where: { userId } });
    await tx.studentDocument.deleteMany({ where: { userId } });
    await tx.studentNotification.deleteMany({ where: { userId } });
    await tx.notificationPreference.deleteMany({ where: { userId } });
    await tx.studentProfile.deleteMany({ where: { userId } });
    await tx.universityComparison.deleteMany({ where: { userId } });
    await tx.studyNote.deleteMany({ where: { userId } });
    // Usage rows reference conversations with SetNull; remove them first so
    // no metadata link to the private history survives the deletion.
    await tx.advisorUsage.deleteMany({ where: { userId } });
    await tx.advisorConversation.deleteMany({ where: { userId } });
    // Grants owned by this user are removed. Grants this administrator gave to
    // *other* users must survive, with attribution detached instead.
    await tx.adminPermissionGrant.deleteMany({ where: { userId } });
    await tx.adminPermissionGrant.updateMany({
      where: { grantedById: userId },
      data: { grantedById: null },
    });
    await tx.user.update({
      where: { id: userId },
      data: {
        email: `deleted+${userId}@edubridge.invalid`,
        name: "Deleted account",
        passwordHash: null,
        mfaSecret: null,
        mfaEnabledAt: null,
        dateOfBirth: null,
        emailVerifiedAt: null,
        role: "STUDENT",
        deletedAt: new Date(),
      },
    });
  });

  await recordAuditEvent({
    action: "account.deleted",
    entityType: "User",
    entityId: userId,
    ip: context.ip,
  });

  return { ok: true };
}
