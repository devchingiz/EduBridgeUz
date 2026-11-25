import "server-only";

import { redirect } from "next/navigation";

import { getVerificationEnforcementStart } from "@/lib/env";

/**
 * One fixed rollout timestamp plus a constant 30-day legacy grace window.
 * Redeploying must not reset this clock, so the start comes only from config.
 */
export const VERIFICATION_GRACE_DAYS = 30;
export const EMAIL_VERIFICATION_REDIRECT = "/verify-email";

const GRACE_PERIOD_MS = VERIFICATION_GRACE_DAYS * 24 * 60 * 60 * 1000;

export type VerificationSubject = {
  emailVerifiedAt: Date | null;
  createdAt: Date;
};

export type VerificationRequirement =
  | { state: "verified" }
  | { state: "grace"; deadline: Date }
  | {
      state: "required";
      reason: "new_account" | "grace_expired" | "configuration_invalid";
    };

export function verificationGraceDeadline(start: Date): Date {
  return new Date(start.getTime() + GRACE_PERIOD_MS);
}

/**
 * Uses `emailVerifiedAt` as the only verification flag. Accounts created on or
 * after the fixed enforcement start must verify immediately; older unverified
 * accounts keep their 30-day grace window.
 */
export function getVerificationRequirement(
  user: VerificationSubject,
  now: Date = new Date(),
): VerificationRequirement {
  if (user.emailVerifiedAt) return { state: "verified" };

  const start = getVerificationEnforcementStart();
  // A missing or malformed rollout timestamp must never bypass verification.
  // Readiness also blocks such an instance from production traffic.
  if (!start) return { state: "required", reason: "configuration_invalid" };

  if (user.createdAt >= start) {
    return { state: "required", reason: "new_account" };
  }

  const deadline = verificationGraceDeadline(start);
  if (now < deadline) return { state: "grace", deadline };

  return { state: "required", reason: "grace_expired" };
}

/** Redirect helper for pages, Server Actions, and the workspace DAL. */
export function requireEmailVerification(
  user: VerificationSubject,
  now?: Date,
): void {
  if (getVerificationRequirement(user, now).state === "required") {
    redirect(EMAIL_VERIFICATION_REDIRECT);
  }
}
