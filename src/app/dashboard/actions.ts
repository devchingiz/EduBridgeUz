"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser, requireWorkspace } from "@/lib/auth/dal";
import {
  changePassword,
  deleteAccount,
  resendGuardianConsent,
  updateProfile,
} from "@/lib/auth/service";
import {
  clearSessionCookie,
  revokeAllSessions,
  revokeSession,
} from "@/lib/auth/session";
import { AUTH_RATE_LIMITS } from "@/lib/auth/rate-limits";
import {
  errorState,
  rateLimitState,
  successState,
  type FormState,
} from "@/lib/actions/state";
import { assertSameOrigin, getRequestContext } from "@/lib/http/request";
import { enforceRateLimits } from "@/lib/security/rate-limit";
import {
  changePasswordSchema,
  deleteAccountSchema,
  guardianContactSchema,
  parseBudgetAmount,
  profileSchema,
  revokeSessionSchema,
  toFieldErrors,
} from "@/lib/validation/auth";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function updateProfileAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const context = await getRequestContext();
  const session = await requireWorkspace();

  const limited = await enforceRateLimits([
    { ...AUTH_RATE_LIMITS.profileUser, identifier: session.user.id },
  ]);
  if (limited) return rateLimitState(limited.retryAfterSeconds);

  const fieldsOfStudy = formData
    .getAll("fieldsOfStudy")
    .filter((value): value is string => typeof value === "string");

  const parsed = profileSchema.safeParse({
    name: text(formData, "name"),
    nationality: text(formData, "nationality"),
    residenceCountry: text(formData, "residenceCountry"),
    currentDegree: text(formData, "currentDegree"),
    targetDegree: text(formData, "targetDegree"),
    fieldsOfStudy,
    englishTest: text(formData, "englishTest"),
    englishScore: text(formData, "englishScore"),
    budgetAmount: text(formData, "budgetAmount"),
    budgetCurrency: text(formData, "budgetCurrency"),
    guardianName: text(formData, "guardianName"),
    guardianEmail: text(formData, "guardianEmail"),
  });

  if (!parsed.success) {
    return errorState(
      "Check the highlighted fields and try again.",
      toFieldErrors(parsed.error),
    );
  }

  const fieldErrors: Record<string, string> = {};

  if (
    parsed.data.budgetAmount &&
    parseBudgetAmount(parsed.data.budgetAmount) === null
  ) {
    fieldErrors.budgetAmount =
      "Enter a whole number between 1 and 1,000,000,000.";
  }
  if (parsed.data.budgetAmount && !parsed.data.budgetCurrency) {
    fieldErrors.budgetCurrency = "Choose a currency for your budget.";
  }
  if (!parsed.data.budgetAmount && parsed.data.budgetCurrency) {
    fieldErrors.budgetAmount = "Enter an amount or clear the currency.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return errorState(
      "Check the highlighted fields and try again.",
      fieldErrors,
    );
  }

  const result = await updateProfile(session.user.id, parsed.data, context);
  if (!result.ok) {
    return errorState("Your profile could not be saved. Try again.");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");

  return successState(
    result.profileComplete
      ? "Profile saved. Your workspace is ready."
      : "Profile saved. Add the remaining details when you can.",
  );
}

export async function changePasswordAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const context = await getRequestContext();
  const session = await requireUser();

  const limited = await enforceRateLimits([
    { ...AUTH_RATE_LIMITS.passwordUser, identifier: session.user.id },
  ]);
  if (limited) return rateLimitState(limited.retryAfterSeconds);

  const parsed = changePasswordSchema.safeParse({
    currentPassword: text(formData, "currentPassword"),
    password: text(formData, "password"),
    confirmPassword: text(formData, "confirmPassword"),
  });

  if (!parsed.success) {
    return errorState(
      "Check the highlighted fields and try again.",
      toFieldErrors(parsed.error),
    );
  }

  const result = await changePassword(
    session.user.id,
    parsed.data.currentPassword,
    parsed.data.password,
    session.session.id,
    context,
  );

  if (!result.ok) {
    if (result.reason === "wrong_password") {
      return errorState("Your current password is incorrect.", {
        currentPassword: "Incorrect password.",
      });
    }
    return errorState("Choose a stronger password.", {
      password: (result.errors ?? []).join(" "),
    });
  }

  return successState(
    "Password changed. Your other sessions have been signed out.",
  );
}

export async function revokeSessionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const session = await requireUser();

  const parsed = revokeSessionSchema.safeParse({
    sessionId: text(formData, "sessionId"),
  });
  if (!parsed.success) {
    return errorState("That session could not be found.");
  }

  const revoked = await revokeSession(parsed.data.sessionId, session.user.id);
  if (!revoked) {
    return errorState("That session is already signed out.");
  }

  revalidatePath("/dashboard/settings");
  return successState("Session signed out.");
}

export async function revokeOtherSessionsAction(
  _previous: FormState,
): Promise<FormState> {
  await assertSameOrigin();
  const session = await requireUser();

  const count = await revokeAllSessions(session.user.id, session.session.id);

  revalidatePath("/dashboard/settings");
  return successState(
    count === 0
      ? "No other sessions were active."
      : `${count} other session${count === 1 ? "" : "s"} signed out.`,
  );
}

export async function resendGuardianConsentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const context = await getRequestContext();
  const session = await requireUser();

  const limited = await enforceRateLimits([
    { ...AUTH_RATE_LIMITS.resendIp, identifier: context.ip },
    { ...AUTH_RATE_LIMITS.resendUser, identifier: session.user.id },
  ]);
  if (limited) return rateLimitState(limited.retryAfterSeconds);

  const guardianName = text(formData, "guardianName");
  const guardianEmail = text(formData, "guardianEmail");
  const hasContact = guardianName.length > 0 || guardianEmail.length > 0;

  let contact: { guardianName: string; guardianEmail: string } | undefined;

  if (hasContact) {
    const parsedContact = guardianContactSchema.safeParse({
      guardianName,
      guardianEmail,
    });

    if (!parsedContact.success) {
      return errorState(
        "Check the guardian details and try again.",
        toFieldErrors(parsedContact.error),
      );
    }

    if (parsedContact.data.guardianEmail === session.user.email) {
      return errorState("Use a different email address for your guardian.", {
        guardianEmail: "Use a different email address.",
      });
    }

    contact = parsedContact.data;
  }

  const result = await resendGuardianConsent(session.user.id, context, contact);

  if (!result.ok) {
    if (result.reason === "not_required") {
      return successState("Guardian consent is already recorded.");
    }
    if (result.reason === "missing_guardian") {
      return errorState(
        "Add your guardian's name and email in your profile first.",
      );
    }
    return errorState("We could not send that email. Try again later.");
  }

  revalidatePath("/dashboard/guardian-consent");
  return successState(
    `We sent a new consent request to ${result.guardianEmail}.`,
  );
}

export async function deleteAccountAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const context = await getRequestContext();
  const session = await requireUser();

  const limited = await enforceRateLimits([
    { ...AUTH_RATE_LIMITS.deleteUser, identifier: session.user.id },
  ]);
  if (limited) return rateLimitState(limited.retryAfterSeconds);

  const parsed = deleteAccountSchema.safeParse({
    password: text(formData, "password"),
    confirmation: text(formData, "confirmation"),
  });

  if (!parsed.success) {
    return errorState(
      "Confirm the deletion to continue.",
      toFieldErrors(parsed.error),
    );
  }

  const result = await deleteAccount(
    session.user.id,
    parsed.data.password,
    context,
  );

  if (!result.ok) {
    return errorState("Your password is incorrect.", {
      password: "Incorrect password.",
    });
  }

  await clearSessionCookie();
  redirect("/?deleted=1");
}
