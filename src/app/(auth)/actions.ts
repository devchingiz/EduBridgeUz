"use server";

import { redirect } from "next/navigation";

import {
  authenticate,
  recordGuardianDecision,
  registerAccount,
  requestPasswordReset,
  resendVerificationEmail,
  resetPasswordWithToken,
  verifyEmailToken,
} from "@/lib/auth/service";
import { getCurrentUser } from "@/lib/auth/dal";
import { destroyCurrentSession, setSessionCookie } from "@/lib/auth/session";
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
import { checkPassword } from "@/lib/security/password";
import {
  enforceRateLimits,
  type RateLimitOptions,
} from "@/lib/security/rate-limit";
import {
  forgotPasswordSchema,
  guardianDecisionSchema,
  loginSchema,
  registerFormSchema,
  resetPasswordSchema,
  toFieldErrors,
  tokenSchema,
} from "@/lib/validation/auth";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function registerAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const context = await getRequestContext();

  const parsed = registerFormSchema.safeParse({
    name: text(formData, "name"),
    email: text(formData, "email"),
    password: text(formData, "password"),
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
  const passwordCheck = checkPassword(parsed.data.password, {
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

  const result = await registerAccount(
    { ...parsed.data, confirmPassword: parsed.data.password },
    context,
  );

  if (!result.ok) {
    if (result.reason === "email_taken") {
      return errorState(
        "An account with this email already exists. Sign in or reset your password.",
        { email: "This email is already registered." },
      );
    }
    return errorState("Choose a stronger password.", {
      password: result.errors.join(" "),
    });
  }

  await setSessionCookie(result.sessionToken);
  redirect("/dashboard?registered=1");
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

  const result = await authenticate(parsed.data, context);

  if (!result.ok) {
    return errorState("Email or password is incorrect.");
  }

  await setSessionCookie(result.sessionToken);
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

  const limited = await enforceRateLimits([
    { ...AUTH_RATE_LIMITS.forgotIp, identifier: context.ip },
    { ...AUTH_RATE_LIMITS.forgotEmail, identifier: parsed.data.email },
  ]);
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

  const limited = await enforceRateLimits([
    { ...AUTH_RATE_LIMITS.resetIp, identifier: context.ip },
  ]);
  if (limited) return rateLimitState(limited.retryAfterSeconds);

  const result = await resetPasswordWithToken(
    parsed.data.token,
    parsed.data.password,
    context,
  );

  if (!result.ok) {
    if (result.reason === "invalid_token") {
      return errorState(
        "This reset link is invalid or has expired. Request a new one.",
      );
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
