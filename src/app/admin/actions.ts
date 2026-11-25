"use server";

import { revalidatePath } from "next/cache";

import { errorState, successState, type FormState } from "@/lib/actions/state";
import {
  grantAdminPermission,
  revokeAdminPermission,
} from "@/lib/admin/permission-grants";
import { changeUserRole, revokeUserSessions } from "@/lib/admin/users";
import { parsePermission, parseRole } from "@/lib/admin/permissions";
import { requireAdminPermission } from "@/lib/auth/dal";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { assertSameOrigin, getRequestContext } from "@/lib/http/request";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function refreshAdmin() {
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/access");
  revalidatePath("/admin/universities");
  revalidatePath("/dashboard/review");
  revalidatePath("/universities");
}

export async function setUserRoleAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const context = await requireAdminPermission("ADMIN_ACCESS");
  if (context.admin.role !== "SUPER_ADMIN") {
    return errorState("Only a Super Admin can change administrator roles.");
  }

  const userId = text(formData, "userId");
  const role = parseRole(text(formData, "role"));
  if (!userId || !role) return errorState("Choose a valid role.");

  const request = await getRequestContext();
  const result = await changeUserRole({
    actorId: context.user.id,
    userId,
    role,
    ip: request.ip,
  });

  if (!result.ok) {
    const messages = {
      forbidden: "Only a Super Admin can change roles.",
      not_found: "That account is no longer available.",
      self: "You cannot change your own role.",
      last_admin: "At least one administrator must remain.",
      last_super_admin: "At least one Super Admin must remain.",
      invalid_role: "Choose a valid role.",
      email_unverified:
        "Verify that account's email before granting admin access.",
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
  const context = await requireAdminPermission("USERS_MANAGE");

  const userId = text(formData, "userId");
  if (!userId) return errorState("Choose an account.");

  const request = await getRequestContext();
  const result = await revokeUserSessions({
    actorId: context.user.id,
    userId,
    ip: request.ip,
  });

  if (!result.ok) {
    const messages = {
      forbidden: "Your role cannot manage sessions.",
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

export async function grantPermissionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const context = await requireAdminPermission("ADMIN_ACCESS");
  if (context.admin.role !== "SUPER_ADMIN") {
    return errorState("Only a Super Admin can grant permissions.");
  }

  const userId = text(formData, "userId");
  const permission = parsePermission(text(formData, "permission"));
  if (!userId || !permission) return errorState("Choose a valid permission.");

  const request = await getRequestContext();
  const result = await grantAdminPermission({
    actorId: context.user.id,
    userId,
    permission,
    ip: request.ip,
  });

  if (!result.ok) {
    const messages = {
      forbidden: "Only a Super Admin can grant permissions.",
      not_found: "That account is no longer available.",
      self: "You cannot grant permissions to yourself.",
      invalid_permission: "Choose a valid permission.",
      invalid_target:
        "Only verified administrator accounts can receive grants.",
    } as const;
    return errorState(messages[result.reason]);
  }

  refreshAdmin();
  return successState(
    result.changed
      ? `Granted ${permission}.`
      : "That permission is already granted.",
  );
}

export async function revokePermissionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const context = await requireAdminPermission("ADMIN_ACCESS");
  if (context.admin.role !== "SUPER_ADMIN") {
    return errorState("Only a Super Admin can revoke permissions.");
  }

  const userId = text(formData, "userId");
  const permission = parsePermission(text(formData, "permission"));
  if (!userId || !permission) return errorState("Choose a valid permission.");

  const request = await getRequestContext();
  const result = await revokeAdminPermission({
    actorId: context.user.id,
    userId,
    permission,
    ip: request.ip,
  });

  if (!result.ok) {
    const messages = {
      forbidden: "Only a Super Admin can revoke permissions.",
      not_found: "That account is no longer available.",
      self: "You cannot revoke your own permissions here.",
      invalid_permission: "Choose a valid permission.",
      invalid_target: "That account is not an administrator.",
    } as const;
    return errorState(messages[result.reason]);
  }

  refreshAdmin();
  return successState(
    result.changed
      ? `Revoked ${permission}.`
      : "That permission was not granted.",
  );
}
