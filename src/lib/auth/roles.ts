import type { Role } from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  STUDENT: "Student",
  REVIEWER: "Reviewer",
  ADMIN: "Administrator",
};

export function isStaff(role: Role): boolean {
  return role === "REVIEWER" || role === "ADMIN";
}
