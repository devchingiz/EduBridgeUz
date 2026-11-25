import type { AdminPermission, Role } from "@prisma/client";

/**
 * Administration permissions are capability names, not UI flags. Every admin
 * page and admin Server Action must re-check the required capability on the
 * server; hidden links are never treated as authorization.
 */
export const ADMIN_PERMISSIONS = [
  "ADMIN_ACCESS",
  "USERS_READ",
  "USERS_MANAGE",
  "CONTENT_READ",
  "CONTENT_MANAGE",
  "MEDIA_READ",
  "MEDIA_MANAGE",
  "UNIVERSITIES_READ",
  "UNIVERSITIES_MANAGE",
  "SCHOLARSHIPS_READ",
  "SCHOLARSHIPS_MANAGE",
  "APPLICATIONS_READ",
  "APPLICATIONS_REVIEW",
  "AI_READ",
  "AI_MANAGE",
  "NOTIFICATIONS_SEND",
  "AUDIT_READ",
  "SETTINGS_READ",
  "SETTINGS_MANAGE",
] as const satisfies readonly AdminPermission[];

export type Permission = (typeof ADMIN_PERMISSIONS)[number];

const ALL_PERMISSIONS: readonly Permission[] = ADMIN_PERMISSIONS;

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  STUDENT: [],
  REVIEWER: [],
  ADMIN: [
    "ADMIN_ACCESS",
    "USERS_READ",
    "USERS_MANAGE",
    "CONTENT_READ",
    "CONTENT_MANAGE",
    "MEDIA_READ",
    "MEDIA_MANAGE",
    "UNIVERSITIES_READ",
    "UNIVERSITIES_MANAGE",
    "SCHOLARSHIPS_READ",
    "SCHOLARSHIPS_MANAGE",
    "APPLICATIONS_READ",
    "APPLICATIONS_REVIEW",
    "AI_READ",
    "NOTIFICATIONS_SEND",
    "AUDIT_READ",
    "SETTINGS_READ",
  ],
  SUPER_ADMIN: ALL_PERMISSIONS,
  CONTENT_MANAGER: [
    "ADMIN_ACCESS",
    "CONTENT_READ",
    "CONTENT_MANAGE",
    "MEDIA_READ",
    "MEDIA_MANAGE",
  ],
  UNIVERSITY_MANAGER: [
    "ADMIN_ACCESS",
    "UNIVERSITIES_READ",
    "UNIVERSITIES_MANAGE",
    "MEDIA_READ",
  ],
  SCHOLARSHIP_MANAGER: [
    "ADMIN_ACCESS",
    "SCHOLARSHIPS_READ",
    "SCHOLARSHIPS_MANAGE",
  ],
  SUPPORT_MANAGER: [
    "ADMIN_ACCESS",
    "USERS_READ",
    "APPLICATIONS_READ",
    "NOTIFICATIONS_SEND",
  ],
};

export const ADMIN_ROLES: readonly Role[] = [
  "ADMIN",
  "SUPER_ADMIN",
  "CONTENT_MANAGER",
  "UNIVERSITY_MANAGER",
  "SCHOLARSHIP_MANAGER",
  "SUPPORT_MANAGER",
];

export const ASSIGNABLE_ROLES: readonly Role[] = [
  "STUDENT",
  "REVIEWER",
  ...ADMIN_ROLES,
];

export function isAdminRole(role: Role): boolean {
  return ADMIN_ROLES.includes(role);
}

export function isSuperAdmin(role: Role): boolean {
  return role === "SUPER_ADMIN";
}

export function parsePermission(value: string): Permission | null {
  return ADMIN_PERMISSIONS.find((permission) => permission === value) ?? null;
}

export function parseRole(value: string): Role | null {
  return ASSIGNABLE_ROLES.find((role) => role === value) ?? null;
}

export function hasRolePermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function rolePermissions(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function resolveAdminPermissions(
  role: Role,
  grants: readonly Permission[] = [],
): Set<Permission> {
  const resolved = new Set<Permission>([
    ...ROLE_PERMISSIONS[role],
    ...grants.filter((permission) => ADMIN_PERMISSIONS.includes(permission)),
  ]);
  return resolved;
}
