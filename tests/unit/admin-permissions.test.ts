import { describe, expect, it } from "vitest";

import {
  ADMIN_PERMISSIONS,
  ADMIN_ROLES,
  hasRolePermission,
  isAdminRole,
  isSuperAdmin,
  parsePermission,
  parseRole,
  resolveAdminPermissions,
  rolePermissions,
} from "@/lib/admin/permissions";

describe("administration permissions", () => {
  it("reserves Super Admin-only capabilities", () => {
    expect(isSuperAdmin("SUPER_ADMIN")).toBe(true);
    expect(isSuperAdmin("ADMIN")).toBe(false);
    expect(ADMIN_ROLES).toContain("SUPER_ADMIN");
    expect(rolePermissions("SUPER_ADMIN")).toEqual(ADMIN_PERMISSIONS);
  });

  it("scopes the manager roles to their own domains", () => {
    expect(hasRolePermission("CONTENT_MANAGER", "CONTENT_MANAGE")).toBe(true);
    expect(hasRolePermission("CONTENT_MANAGER", "UNIVERSITIES_MANAGE")).toBe(
      false,
    );
    expect(hasRolePermission("UNIVERSITY_MANAGER", "UNIVERSITIES_MANAGE")).toBe(
      true,
    );
    expect(hasRolePermission("UNIVERSITY_MANAGER", "SCHOLARSHIPS_MANAGE")).toBe(
      false,
    );
    expect(
      hasRolePermission("SCHOLARSHIP_MANAGER", "SCHOLARSHIPS_MANAGE"),
    ).toBe(true);
    expect(hasRolePermission("SUPPORT_MANAGER", "APPLICATIONS_READ")).toBe(
      true,
    );
    expect(hasRolePermission("SUPPORT_MANAGER", "USERS_MANAGE")).toBe(false);
  });

  it("never lets a student or reviewer enter the admin surface by default", () => {
    expect(isAdminRole("STUDENT")).toBe(false);
    expect(isAdminRole("REVIEWER")).toBe(false);
    expect(resolveAdminPermissions("STUDENT").size).toBe(0);
    expect(resolveAdminPermissions("REVIEWER").size).toBe(0);
  });

  it("adds grants on top of role defaults and ignores unknown values", () => {
    const permissions = resolveAdminPermissions("CONTENT_MANAGER", [
      "USERS_READ",
      "NOT_A_REAL_PERMISSION" as "USERS_READ",
    ]);
    expect(permissions.has("CONTENT_MANAGE")).toBe(true);
    expect(permissions.has("USERS_READ")).toBe(true);
    expect(permissions.size).toBe(
      rolePermissions("CONTENT_MANAGER").length + 1,
    );
  });

  it("parses only known roles and permissions from untrusted input", () => {
    expect(parseRole("SUPER_ADMIN")).toBe("SUPER_ADMIN");
    expect(parseRole("OWNER")).toBeNull();
    expect(parsePermission("ADMIN_ACCESS")).toBe("ADMIN_ACCESS");
    expect(parsePermission("DELETE_EVERYTHING")).toBeNull();
  });
});
