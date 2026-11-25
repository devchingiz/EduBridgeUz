import "server-only";

import { db } from "@/lib/db";
import {
  isAdminRole,
  resolveAdminPermissions,
  type Permission,
} from "@/lib/admin/permissions";
import type { Role } from "@prisma/client";

export type AdminContext = {
  userId: string;
  email: string;
  name: string;
  role: Role;
  emailVerifiedAt: Date;
  grants: Permission[];
  permissions: ReadonlySet<Permission>;
};

/**
 * Loads the authoritative administration context for a signed-in user.
 * Returns null for students, unverified accounts, deleted accounts, and roles
 * that do not belong to the administration panel.
 */
export async function loadAdminContext(
  userId: string,
): Promise<AdminContext | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerifiedAt: true,
      deletedAt: true,
      adminPermissionGrants: {
        select: { permission: true },
      },
    },
  });

  if (!user || user.deletedAt || !user.emailVerifiedAt) return null;
  if (!isAdminRole(user.role)) return null;

  const grants = user.adminPermissionGrants.map(
    (grant) => grant.permission as Permission,
  );

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    emailVerifiedAt: user.emailVerifiedAt,
    grants,
    permissions: resolveAdminPermissions(user.role, grants),
  };
}
