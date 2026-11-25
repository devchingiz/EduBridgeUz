import type { Role } from "@prisma/client";
import { isAdminRole } from "@/lib/admin/permissions";

export const ROLE_LABELS: Record<Role, string> = {
  STUDENT: "Student",
  REVIEWER: "Reviewer",
  ADMIN: "Administrator",
  SUPER_ADMIN: "Super Admin",
  CONTENT_MANAGER: "Content Manager",
  UNIVERSITY_MANAGER: "University Manager",
  SCHOLARSHIP_MANAGER: "Scholarship Manager",
  SUPPORT_MANAGER: "Support Manager",
};

export function isStaff(role: Role): boolean {
  return role === "REVIEWER" || role === "ADMIN";
}

/** Whether an account may open the separate /admin administration surface. */
export function isAdminPanelRole(role: Role): boolean {
  return isAdminRole(role);
}
