"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/dal";
import {
  beginMfaEnrollment,
  confirmMfaEnrollment,
  disableMfa,
} from "@/lib/auth/mfa";
import { AUTH_RATE_LIMITS } from "@/lib/auth/rate-limits";
import { rateLimitState, type FormState } from "@/lib/actions/state";
import { assertSameOrigin, getRequestContext } from "@/lib/http/request";
import { enforceRateLimits } from "@/lib/security/rate-limit";
import {
  mfaCodeSchema,
  mfaConfirmSchema,
  toFieldErrors,
} from "@/lib/validation/auth";

export type MfaSettingsState = FormState & {
  /** Returned once, only to the enrolling user; never persisted in plaintext. */
  secret?: string;
  provisioningUri?: string;
  recoveryCodes?: string[];
};

export const initialMfaState: MfaSettingsState = { status: "idle" };

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function mfaManageLimit(userId: string) {
  return enforceRateLimits([
    { ...AUTH_RATE_LIMITS.mfaManageUser, identifier: userId },
  ]);
}

export async function beginMfaEnrollmentAction(
  _previous: MfaSettingsState,
  _formData: FormData,
): Promise<MfaSettingsState> {
  await assertSameOrigin();
  const context = await getRequestContext();
  const session = await requireUser();

  const limited = await mfaManageLimit(session.user.id);
  if (limited) return rateLimitState(limited.retryAfterSeconds);

  const enrollment = await beginMfaEnrollment(session.user.id, context.ip);
  if (!enrollment) {
    return {
      status: "error",
      message: "Two-factor authentication is already enabled on this account.",
    };
  }

  return {
    status: "idle",
    secret: enrollment.secret,
    provisioningUri: enrollment.provisioningUri,
    recoveryCodes: enrollment.recoveryCodes,
  };
}

export async function confirmMfaEnrollmentAction(
  _previous: MfaSettingsState,
  formData: FormData,
): Promise<MfaSettingsState> {
  await assertSameOrigin();
  const context = await getRequestContext();
  const session = await requireUser();

  const limited = await mfaManageLimit(session.user.id);
  if (limited) return rateLimitState(limited.retryAfterSeconds);

  const parsed = mfaConfirmSchema.safeParse({ code: text(formData, "code") });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted field and try again.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const confirmed = await confirmMfaEnrollment(
    session.user.id,
    parsed.data.code,
    context.ip,
  );
  if (!confirmed) {
    return {
      status: "error",
      message:
        "That code did not match. Make sure your device clock is accurate and try again.",
      fieldErrors: { code: "Invalid code." },
    };
  }

  revalidatePath("/dashboard/settings");
  return {
    status: "success",
    message: "Two-factor authentication is now enabled.",
  };
}

export async function disableMfaAction(
  _previous: MfaSettingsState,
  formData: FormData,
): Promise<MfaSettingsState> {
  await assertSameOrigin();
  const context = await getRequestContext();
  const session = await requireUser();

  const limited = await mfaManageLimit(session.user.id);
  if (limited) return rateLimitState(limited.retryAfterSeconds);

  const parsed = mfaCodeSchema.safeParse({ code: text(formData, "code") });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Enter your current 6-digit code or a recovery code.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const disabled = await disableMfa(
    session.user.id,
    parsed.data.code,
    context.ip,
  );
  if (!disabled) {
    return {
      status: "error",
      message: "That code is not valid.",
      fieldErrors: { code: "Invalid code." },
    };
  }

  revalidatePath("/dashboard/settings");
  return {
    status: "success",
    message: "Two-factor authentication has been disabled.",
  };
}
