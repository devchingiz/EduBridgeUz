import { describe, expect, it } from "vitest";

import { ROLE_LABELS, isStaff } from "@/lib/auth/roles";

describe("roles", () => {
  it("labels every role", () => {
    expect(ROLE_LABELS.STUDENT).toBe("Student");
    expect(ROLE_LABELS.REVIEWER).toBe("Reviewer");
    expect(ROLE_LABELS.ADMIN).toBe("Administrator");
  });

  it("treats reviewers and admins as staff, but not students", () => {
    expect(isStaff("STUDENT")).toBe(false);
    expect(isStaff("REVIEWER")).toBe(true);
    expect(isStaff("ADMIN")).toBe(true);
  });
});
