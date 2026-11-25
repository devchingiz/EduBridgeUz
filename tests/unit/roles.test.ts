import { describe, expect, it } from "vitest";

import { isAdminPanelRole, isStaff, ROLE_LABELS } from "@/lib/auth/roles";

describe("roles", () => {
  it("labels every role", () => {
    expect(ROLE_LABELS.STUDENT).toBe("Student");
    expect(ROLE_LABELS.REVIEWER).toBe("Reviewer");
    expect(ROLE_LABELS.ADMIN).toBe("Administrator");
    expect(ROLE_LABELS.SUPER_ADMIN).toBe("Super Admin");
    expect(ROLE_LABELS.CONTENT_MANAGER).toBe("Content Manager");
    expect(ROLE_LABELS.UNIVERSITY_MANAGER).toBe("University Manager");
    expect(ROLE_LABELS.SCHOLARSHIP_MANAGER).toBe("Scholarship Manager");
    expect(ROLE_LABELS.SUPPORT_MANAGER).toBe("Support Manager");
  });

  it("treats reviewers and admins as staff, but not students", () => {
    expect(isStaff("STUDENT")).toBe(false);
    expect(isStaff("REVIEWER")).toBe(true);
    expect(isStaff("ADMIN")).toBe(true);
    expect(isStaff("CONTENT_MANAGER")).toBe(false);
  });

  it("recognises every administration role for the /admin surface", () => {
    expect(isAdminPanelRole("STUDENT")).toBe(false);
    expect(isAdminPanelRole("REVIEWER")).toBe(false);
    expect(isAdminPanelRole("ADMIN")).toBe(true);
    expect(isAdminPanelRole("SUPER_ADMIN")).toBe(true);
    expect(isAdminPanelRole("CONTENT_MANAGER")).toBe(true);
    expect(isAdminPanelRole("UNIVERSITY_MANAGER")).toBe(true);
    expect(isAdminPanelRole("SCHOLARSHIP_MANAGER")).toBe(true);
    expect(isAdminPanelRole("SUPPORT_MANAGER")).toBe(true);
  });
});
