"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";

import {
  ASSIGNABLE_UNIVERSITY_STATUSES,
  setAdminUniversityStatus,
} from "@/lib/admin/universities";
import {
  ASSIGNABLE_ROLES,
  changeUserRole,
  revokeUserSessions,
} from "@/lib/admin/users";
import type { VerificationStatusValue } from "@/lib/catalog/constants";
import { errorState, successState, type FormState } from "@/lib/actions/state";
import { requireRole } from "@/lib/auth/dal";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { assertSameOrigin, getRequestContext } from "@/lib/http/request";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function roleFrom(formData: FormData): Role | null {
  const value = text(formData, "role");
  return ASSIGNABLE_ROLES.find((role) => role === value) ?? null;
}

function refreshAdmin() {
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/admin/users");
  revalidatePath("/dashboard/admin/universities");
  revalidatePath("/dashboard/review");
  revalidatePath("/universities");
}

export async function setUserRoleAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const session = await requireRole(["ADMIN"]);

  const userId = text(formData, "userId");
  const role = roleFrom(formData);
  if (!userId || !role) return errorState("Choose a valid role.");

  const context = await getRequestContext();
  const result = await changeUserRole({
    actorId: session.user.id,
    userId,
    role,
    ip: context.ip,
  });

  if (!result.ok) {
    const messages = {
      forbidden: "Only administrators can change roles.",
      not_found: "That account is no longer available.",
      self: "You cannot change your own role here.",
      last_admin: "At least one administrator must remain.",
      invalid_role: "Choose a valid role.",
    } as const;
    return errorState(messages[result.reason]);
  }

  refreshAdmin();
  return successState(
    result.changed
      ? `Role updated to ${ROLE_LABELS[role]}.`
      : `This account already has the ${ROLE_LABELS[role]} role.`,
  );
}

export async function revokeUserSessionsAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const session = await requireRole(["ADMIN"]);

  const userId = text(formData, "userId");
  if (!userId) return errorState("Choose an account.");

  const context = await getRequestContext();
  const result = await revokeUserSessions({
    actorId: session.user.id,
    userId,
    ip: context.ip,
  });

  if (!result.ok) {
    const messages = {
      forbidden: "Only administrators can manage sessions.",
      not_found: "That account is no longer available.",
      self: "Use Account settings to sign out your own sessions.",
    } as const;
    return errorState(messages[result.reason]);
  }

  refreshAdmin();
  return successState(
    result.count === 0
      ? "This account has no active sessions."
      : `Signed out ${result.count} active session${result.count === 1 ? "" : "s"}.`,
  );
}

export async function setUniversityStatusAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const session = await requireRole(["ADMIN"]);

  const universityId = text(formData, "universityId");
  const requested = text(formData, "status");
  const status = ASSIGNABLE_UNIVERSITY_STATUSES.find(
    (candidate): candidate is VerificationStatusValue =>
      candidate === requested,
  );
  if (!universityId || !status) return errorState("Choose a valid status.");

  const context = await getRequestContext();
  const result = await setAdminUniversityStatus({
    actorId: session.user.id,
    universityId,
    status,
    ip: context.ip,
  });

  if (!result.ok) {
    const messages = {
      not_found: "That university is no longer available.",
      invalid_status: "Choose a valid status.",
      unchanged: "The university already has that status.",
    } as const;
    return errorState(messages[result.reason]);
  }

  refreshAdmin();
  return successState(
    `Status updated to ${status.toLowerCase().replaceAll("_", " ")}.`,
  );
}
