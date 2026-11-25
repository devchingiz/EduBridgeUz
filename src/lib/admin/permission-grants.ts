import "server-only";

import { db } from "@/lib/db";
import { recordAuditEvent } from "@/lib/auth/audit";
import {
  isAdminRole,
  isSuperAdmin,
  type Permission,
} from "@/lib/admin/permissions";

export type PermissionGrantResult =
  | { ok: true; changed: boolean }
  | {
      ok: false;
      reason:
        | "forbidden"
        | "not_found"
        | "self"
        | "invalid_permission"
        | "invalid_target";
    };

export async function listAdminPermissionGrants(
  userIds: readonly string[],
): Promise<Map<string, Permission[]>> {
  if (userIds.length === 0) return new Map();
  const grants = await db.adminPermissionGrant.findMany({
    where: { userId: { in: [...userIds] } },
    select: { userId: true, permission: true },
    orderBy: { permission: "asc" },
  });
  const grouped = new Map<string, Permission[]>();
  for (const grant of grants) {
    const list = grouped.get(grant.userId) ?? [];
    list.push(grant.permission as Permission);
    grouped.set(grant.userId, list);
  }
  return grouped;
}

async function assertSuperAdminActor(actorId: string): Promise<boolean> {
  const actor = await db.user.findUnique({
    where: { id: actorId },
    select: { role: true, deletedAt: true },
  });
  return Boolean(actor && !actor.deletedAt && isSuperAdmin(actor.role));
}

export async function grantAdminPermission({
  actorId,
  userId,
  permission,
  ip,
}: {
  actorId: string;
  userId: string;
  permission: Permission;
  ip?: string;
}): Promise<PermissionGrantResult> {
  if (!(await assertSuperAdminActor(actorId))) {
    return { ok: false, reason: "forbidden" };
  }
  if (actorId === userId) return { ok: false, reason: "self" };

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, deletedAt: true, emailVerifiedAt: true },
  });
  if (!target || target.deletedAt) return { ok: false, reason: "not_found" };
  if (!isAdminRole(target.role) || !target.emailVerifiedAt) {
    return { ok: false, reason: "invalid_target" };
  }

  const existing = await db.adminPermissionGrant.findUnique({
    where: { userId_permission: { userId, permission } },
    select: { id: true },
  });
  if (existing) return { ok: true, changed: false };

  await db.adminPermissionGrant.create({
    data: { userId, permission, grantedById: actorId },
  });
  await recordAuditEvent({
    actorId,
    action: "admin.permission_granted",
    entityType: "User",
    entityId: userId,
    metadata: { permission, source: "admin_panel" },
    ip,
  });

  return { ok: true, changed: true };
}

export async function revokeAdminPermission({
  actorId,
  userId,
  permission,
  ip,
}: {
  actorId: string;
  userId: string;
  permission: Permission;
  ip?: string;
}): Promise<PermissionGrantResult> {
  if (!(await assertSuperAdminActor(actorId))) {
    return { ok: false, reason: "forbidden" };
  }
  if (actorId === userId) return { ok: false, reason: "self" };

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, deletedAt: true },
  });
  if (!target || target.deletedAt) return { ok: false, reason: "not_found" };
  if (!isAdminRole(target.role)) return { ok: false, reason: "invalid_target" };

  const result = await db.adminPermissionGrant.deleteMany({
    where: { userId, permission },
  });
  if (result.count === 0) return { ok: true, changed: false };

  await recordAuditEvent({
    actorId,
    action: "admin.permission_revoked",
    entityType: "User",
    entityId: userId,
    metadata: { permission, source: "admin_panel" },
    ip,
  });

  return { ok: true, changed: true };
}
