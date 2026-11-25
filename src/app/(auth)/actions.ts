"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  authenticate,
  completeMfaLogin,
  recordGuardianDecision,
  registerAccount,
  requestPasswordReset,
  resendVerificationEmail,
  resetPasswordWithToken,
  verifyEmailToken,
} from "@/lib/auth/service";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireEmailVerification } from "@/lib/auth/verification-policy";
import { destroyCurrentSession, setSessionCookie } from "@/lib/auth/session";
import { verifyMfaChallenge } from "@/lib/auth/mfa";
import {
  clearMfaChallengeCookie,
  getMfaChallengeCookie,
  setMfaChallengeCookie,
} from "@/lib/auth/mfa-challenge-cookie";
import { AUTH_RATE_LIMITS } from "@/lib/auth/rate-limits";
import {
  errorState,
  rateLimitState,
  successState,
  type FormState,
} from "@/lib/actions/state";
import {
  assertSameOrigin,
  getRequestContext,
  hasClientIp,
} from "@/lib/http/request";
import { enforcePasswordPolicy } from "@/lib/security/password";
import { hashToken } from "@/lib/security/crypto";
import {
  checkRateLimits,
  enforceRateLimits,
  type RateLimitOptions,
} from "@/lib/security/rate-limit";
import {
  forgotPasswordSchema,
  guardianDecisionSchema,
  loginSchema,
  mfaCodeSchema,
  registerSchema,
  resetPasswordSchema,
  toFieldErrors,
  tokenSchema,
} from "@/lib/validation/auth";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function signInRateLimits(email: string, ip: string): RateLimitOptions[] {
  const limits: RateLimitOptions[] = [
    { ...AUTH_RATE_LIMITS.signInEmail, identifier: email },
  ];
  if (hasClientIp(ip)) {
    limits.unshift({ ...AUTH_RATE_LIMITS.signInIp, identifier: ip });
  }
  return limits;
}

export async function registerAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const context = await getRequestContext();

  const parsed = registerSchema.safeParse({
    name: text(formData, "name"),
    email: text(formData, "email"),
    password: text(formData, "password"),
    confirmPassword: text(formData, "confirmPassword"),
    dateOfBirth: text(formData, "dateOfBirth"),
    guardianName: text(formData, "guardianName"),
    guardianEmail: text(formData, "guardianEmail"),
    acceptTerms: text(formData, "acceptTerms") === "on",
  });

  if (!parsed.success) {
    return errorState(
      "Check the highlighted fields and try again.",
      toFieldErrors(parsed.error),
    );
  }

  // Reject weak passwords before touching the counter. The form used to count
  // every correction as an attempt, which locked students out before they had
  // submitted a valid registration.
  const passwordCheck = await enforcePasswordPolicy(parsed.data.password, {
    email: parsed.data.email,
    name: parsed.data.name,
  });
  if (!passwordCheck.ok) {
    return errorState("Choose a stronger password.", {
      password: passwordCheck.errors.join(" "),
    });
  }

  const limits: RateLimitOptions[] = [
    { ...AUTH_RATE_LIMITS.registerEmail, identifier: parsed.data.email },
  ];
  if (hasClientIp(context.ip)) {
    limits.unshift({
      ...AUTH_RATE_LIMITS.registerIp,
      identifier: context.ip,
    });
  }

  const limited = await enforceRateLimits(limits);
  if (limited) return rateLimitState(limited.retryAfterSeconds);

  const result = await registerAccount(parsed.data, context);

  if (!result.ok) {
    if (result.reason === "email_taken") {
      // Same public response as a successful registration. Recovery
      // instructions are emailed; the response reveals no account state.
      return redirect("/verify-email");
    }
    return errorState("Choose a stronger password.", {
      password: result.errors.join(" "),
    });
  }

  await setSessionCookie(result.sessionToken);
  redirect("/verify-email");
}

export async function loginAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const context = await getRequestContext();

  const parsed = loginSchema.safeParse({
    email: text(formData, "email"),
    password: text(formData, "password"),
  });

  if (!parsed.success) {
    return errorState(
      "Enter your email and password.",
      toFieldErrors(parsed.error),
    );
  }

  const limits = signInRateLimits(parsed.data.email, context.ip);

  // Do not verify another password once a counter is exhausted. This read does
  // not consume an attempt, so a correct password still signs in during a
  // lockout and a targeted attacker cannot lock someone else out permanently.
  const exhausted = await checkRateLimits(limits);
  if (exhausted) return rateLimitState(exhausted.retryAfterSeconds);

  const result = await authenticate(parsed.data, context);

  if (!result.ok) {
    const limitReached = await enforceRateLimits(limits);
    if (limitReached) return rateLimitState(limitReached.retryAfterSeconds);
    return errorState("Email or password is incorrect.");
  }

  // An enrolled account never receives a session from its password alone.
  // Pass the short-lived challenge to the MFA page through an HttpOnly cookie.
  if (result.mfaRequired) {
    await setMfaChallengeCookie(result.mfaChallengeToken);
    redirect("/mfa");
  }

  await setSessionCookie(result.sessionToken);
  requireEmailVerification(result);
  redirect("/dashboard");
}

export async function verifyMfaAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const context = await getRequestContext();

  const parsed = mfaCodeSchema.safeParse({ code: text(formData, "code") });
  if (!parsed.success) {
    return errorState("Enter the 6-digit code from your authenticator app.", {
      code: "Enter a valid code.",
    });
  }

  const challengeToken = await getMfaChallengeCookie();
  if (!challengeToken) {
    return errorState("Your sign-in session expired. Please sign in again.");
  }

  const limits: RateLimitOptions[] = [
    {
      ...AUTH_RATE_LIMITS.mfaVerifyChallenge,
      identifier: hashToken(challengeToken),
    },
  ];
  if (hasClientIp(context.ip)) {
    limits.unshift({
      ...AUTH_RATE_LIMITS.mfaVerifyIp,
      identifier: context.ip,
    });
  }

  const exhausted = await checkRateLimits(limits);
  if (exhausted) return rateLimitState(exhausted.retryAfterSeconds);

  const verification = await verifyMfaChallenge(
    challengeToken,
    parsed.data.code,
    context.ip,
  );

  if (!verification.ok) {
    const limitReached = await enforceRateLimits(limits);
    if (limitReached) return rateLimitState(limitReached.retryAfterSeconds);
    return errorState(
      verification.reason === "invalid_challenge"
        ? "Your sign-in session expired. Please sign in again."
        : "That code is not valid. Try again or use a recovery code.",
    );
  }

  const login = await completeMfaLogin(verification.userId, context);
  if (!login) {
    return errorState(
      "This account is no longer available. Please contact support.",
    );
  }

  await clearMfaChallengeCookie();
  await setSessionCookie(login.sessionToken);
  requireEmailVerification(login);
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await assertSameOrigin();
  await destroyCurrentSession();
  redirect("/login?loggedOut=1");
}

export async function forgotPasswordAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const context = await getRequestContext();

  const parsed = forgotPasswordSchema.safeParse({
    email: text(formData, "email"),
  });

  if (!parsed.success) {
    return errorState("Enter a valid email address.", {
      email: toFieldErrors(parsed.error).email,
    });
  }

  const forgotLimits: RateLimitOptions[] = [
    { ...AUTH_RATE_LIMITS.forgotEmail, identifier: parsed.data.email },
  ];
  if (hasClientIp(context.ip)) {
    forgotLimits.unshift({
      ...AUTH_RATE_LIMITS.forgotIp,
      identifier: context.ip,
    });
  }

  const limited = await enforceRateLimits(forgotLimits);
  if (limited) return rateLimitState(limited.retryAfterSeconds);

  await requestPasswordReset(parsed.data.email, context);

  return successState(
    "If an account exists for that email, we sent a reset link. Check your inbox and spam folder.",
  );
}

export async function resetPasswordAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const context = await getRequestContext();

  const parsed = resetPasswordSchema.safeParse({
    token: text(formData, "token"),
    password: text(formData, "password"),
    confirmPassword: text(formData, "confirmPassword"),
  });

  if (!parsed.success) {
    return errorState(
      "Check the highlighted fields and try again.",
      toFieldErrors(parsed.error),
    );
  }

  const resetLimits: RateLimitOptions[] = [
    {
      ...AUTH_RATE_LIMITS.resetToken,
      identifier: hashToken(parsed.data.token),
    },
  ];
  if (hasClientIp(context.ip)) {
    resetLimits.unshift({
      ...AUTH_RATE_LIMITS.resetIp,
      identifier: context.ip,
    });
  }

  const limited = await enforceRateLimits(resetLimits);
  if (limited) return rateLimitState(limited.retryAfterSeconds);

  const result = await resetPasswordWithToken(
    parsed.data.token,
    parsed.data.password,
    parsed.data.confirmPassword,
    context,
  );

  if (!result.ok) {
    if (result.reason === "invalid_token") {
      return errorState(
        "This reset link is invalid or has expired. Request a new one.",
      );
    }
    if (result.reason === "password_mismatch") {
      return errorState("Check the highlighted fields and try again.", {
        confirmPassword: "Passwords do not match.",
      });
    }
    return errorState("Choose a stronger password.", {
      password: (result.errors ?? []).join(" "),
    });
  }

  redirect("/login?reset=1");
}

export async function verifyEmailAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const context = await getRequestContext();

  const parsed = tokenSchema.safeParse({ token: text(formData, "token") });
  if (!parsed.success) {
    return errorState("This verification link is invalid or has expired.");
  }

  const limited = await enforceRateLimits([
    { ...AUTH_RATE_LIMITS.resendIp, identifier: context.ip },
  ]);
  if (limited) return rateLimitState(limited.retryAfterSeconds);

  const result = await verifyEmailToken(parsed.data.token, context);
  if (!result.ok) {
    return errorState(
      "This verification link is invalid or has expired. Sign in and request a new one.",
    );
  }

  // The dashboard layout reads emailVerifiedAt from the database on every
  // render; invalidate its cached RSC payload so the banner disappears on the
  // next dashboard visit.
  revalidatePath("/dashboard", "layout");
  redirect("/login?verified=1");
}

export async function resendVerificationAction(
  _previous: FormState,
): Promise<FormState> {
  await assertSameOrigin();
  const context = await getRequestContext();
  const user = await getCurrentUser();

  if (!user) {
    return errorState("Sign in to request a new verification link.");
  }

  const limited = await enforceRateLimits([
    { ...AUTH_RATE_LIMITS.resendIp, identifier: context.ip },
    { ...AUTH_RATE_LIMITS.resendUser, identifier: user.id },
  ]);
  if (limited) return rateLimitState(limited.retryAfterSeconds);

  const result = await resendVerificationEmail(user.id, context);
  if (!result.ok) {
    return errorState("We could not send that email. Try again later.");
  }
  if (result.alreadyVerified) {
    revalidatePath("/dashboard", "layout");
    return successState("Your email is already verified.");
  }

  return successState(
    "We sent a new verification link. Check your inbox and spam folder.",
  );
}

export async function guardianDecisionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const context = await getRequestContext();

  const parsed = guardianDecisionSchema.safeParse({
    token: text(formData, "token"),
    decision: text(formData, "decision"),
  });

  if (!parsed.success) {
    return errorState("This consent link is invalid or has expired.");
  }

  const limited = await enforceRateLimits([
    { ...AUTH_RATE_LIMITS.guardianIp, identifier: context.ip },
  ]);
  if (limited) return rateLimitState(limited.retryAfterSeconds);

  const result = await recordGuardianDecision(
    parsed.data.token,
    parsed.data.decision,
    context,
  );

  if (!result.ok) {
    return errorState(
      "This consent link is invalid, expired, or has already been used.",
    );
  }

  redirect(
    `/guardian-consent/complete?decision=${
      result.decision === "approve" ? "approved" : "declined"
    }`,
  );
}
