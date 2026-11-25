import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import {
  grantAdminPermission,
  revokeAdminPermission,
} from "@/lib/admin/permission-grants";
import {
  changeUserRole,
  listAdminUsers,
  revokeUserSessions,
} from "@/lib/admin/users";
import { authenticate, registerAccount } from "@/lib/auth/service";
import { validateSessionToken } from "@/lib/auth/session";
import type { RegisterInput } from "@/lib/validation/auth";

const PASSWORD = "Correct-Horse-Battery-9";
const originalBootstrapEmails = process.env.BOOTSTRAP_ADMIN_EMAILS;

function dateYearsAgo(years: number): string {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() - years);
  return date.toISOString().slice(0, 10);
}

function adultInput(email: string, name = "Amina Karimova"): RegisterInput {
  return {
    name,
    email,
    password: PASSWORD,
    confirmPassword: PASSWORD,
    dateOfBirth: dateYearsAgo(22),
    guardianName: "",
    guardianEmail: "",
    acceptTerms: true,
  };
}

async function register(email: string, name?: string) {
  const result = await registerAccount(adultInput(email, name));
  if (!result.ok) throw new Error(`registration failed: ${result.reason}`);
  return result;
}

async function forceRole(
  userId: string,
  role: "ADMIN" | "SUPER_ADMIN" | "CONTENT_MANAGER",
) {
  await db.user.update({
    where: { id: userId },
    data: { role, emailVerifiedAt: new Date() },
  });
}

beforeEach(async () => {
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "AdminPermissionGrant", "GoogleOAuthAttempt", "GoogleAccount", "AuditEvent", "ConsentRecord", "AuthToken", "Session", "StudentProfile", "RateLimitCounter", "User" RESTART IDENTITY CASCADE',
  );
});

afterEach(() => {
  if (originalBootstrapEmails === undefined) {
    delete process.env.BOOTSTRAP_ADMIN_EMAILS;
  } else {
    process.env.BOOTSTRAP_ADMIN_EMAILS = originalBootstrapEmails;
  }
});

afterAll(async () => {
  await db.$disconnect();
});

describe("administrator access", () => {
  it("promotes a configured email to Super Admin only after verification and sign-in", async () => {
    process.env.BOOTSTRAP_ADMIN_EMAILS = "owner@example.com";

    const registered = await register("owner@example.com", "Owner Account");
    const unverified = await db.user.findUniqueOrThrow({
      where: { id: registered.userId },
      select: { role: true },
    });
    expect(unverified.role).toBe("STUDENT");

    // Verification proves mailbox control; only then may a sign-in grant the
    // break-glass role.
    await db.user.update({
      where: { id: registered.userId },
      data: { emailVerifiedAt: new Date() },
    });

    const login = await authenticate({
      email: "owner@example.com",
      password: PASSWORD,
    });
    expect(login.ok).toBe(true);
    const promoted = await db.user.findUniqueOrThrow({
      where: { id: registered.userId },
      select: { role: true },
    });
    expect(promoted.role).toBe("SUPER_ADMIN");

    if (!login.ok || login.mfaRequired) throw new Error("login failed");
    const session = await validateSessionToken(login.sessionToken);
    expect(session?.user.role).toBe("SUPER_ADMIN");

    const grant = await db.auditEvent.findFirst({
      where: {
        actorId: registered.userId,
        action: "auth.bootstrap_admin",
      },
    });
    expect(grant?.metadata).toMatchObject({ role: "SUPER_ADMIN" });

    const student = await register("late@example.com", "Late Account");
    process.env.BOOTSTRAP_ADMIN_EMAILS = "owner@example.com, LATE@example.com";
    await db.user.update({
      where: { id: student.userId },
      data: { emailVerifiedAt: new Date() },
    });

    const lateLogin = await authenticate({
      email: "late@example.com",
      password: PASSWORD,
    });
    expect(lateLogin.ok).toBe(true);
    const afterLogin = await db.user.findUniqueOrThrow({
      where: { id: student.userId },
      select: { role: true },
    });
    expect(afterLogin.role).toBe("SUPER_ADMIN");
  });

  it("changes roles only from a Super Admin actor and audits the change", async () => {
    const superAdmin = await register("owner@example.com", "Owner Account");
    const admin = await register("admin@example.com", "Admin Account");
    const student = await register("student@example.com", "Student Account");
    await forceRole(superAdmin.userId, "SUPER_ADMIN");
    await forceRole(admin.userId, "ADMIN");

    const studentActor = await changeUserRole({
      actorId: student.userId,
      userId: student.userId,
      role: "ADMIN",
    });
    expect(studentActor).toEqual({ ok: false, reason: "forbidden" });

    // An ordinary Admin can no longer promote accounts.
    const adminActor = await changeUserRole({
      actorId: admin.userId,
      userId: student.userId,
      role: "REVIEWER",
    });
    expect(adminActor).toEqual({ ok: false, reason: "forbidden" });

    const self = await changeUserRole({
      actorId: superAdmin.userId,
      userId: superAdmin.userId,
      role: "ADMIN",
    });
    expect(self).toEqual({ ok: false, reason: "self" });

    const changed = await changeUserRole({
      actorId: superAdmin.userId,
      userId: student.userId,
      role: "REVIEWER",
    });
    expect(changed).toEqual({
      ok: true,
      previousRole: "STUDENT",
      changed: true,
    });

    const target = await db.user.findUniqueOrThrow({
      where: { id: student.userId },
      select: { role: true },
    });
    expect(target.role).toBe("REVIEWER");

    const audit = await db.auditEvent.findFirst({
      where: {
        action: "admin.user_role_changed",
        entityId: student.userId,
      },
    });
    expect(audit?.metadata).toMatchObject({ from: "STUDENT", to: "REVIEWER" });
  });

  it("refuses to grant an administrator role until the email is verified", async () => {
    const superAdmin = await register("owner@example.com", "Owner Account");
    const student = await register("student@example.com", "Student Account");
    await forceRole(superAdmin.userId, "SUPER_ADMIN");

    const unverified = await changeUserRole({
      actorId: superAdmin.userId,
      userId: student.userId,
      role: "ADMIN",
    });
    expect(unverified).toEqual({ ok: false, reason: "email_unverified" });

    await db.user.update({
      where: { id: student.userId },
      data: { emailVerifiedAt: new Date() },
    });

    const verified = await changeUserRole({
      actorId: superAdmin.userId,
      userId: student.userId,
      role: "CONTENT_MANAGER",
    });
    expect(verified).toEqual({
      ok: true,
      previousRole: "STUDENT",
      changed: true,
    });
  });

  it("lists accounts and revokes another user's sessions", async () => {
    const admin = await register("admin@example.com", "Admin Account");
    const student = await register("amina@example.com", "Amina Karimova");
    await forceRole(admin.userId, "ADMIN");

    const listed = await listAdminUsers({ query: "amina", role: "STUDENT" });
    expect(listed.total).toBe(1);
    expect(listed.users[0]).toMatchObject({
      id: student.userId,
      email: "amina@example.com",
      role: "STUDENT",
      activeSessions: 1,
    });

    const revoked = await revokeUserSessions({
      actorId: admin.userId,
      userId: student.userId,
    });
    expect(revoked).toEqual({ ok: true, count: 1 });
    expect(await validateSessionToken(student.sessionToken)).toBeNull();
  });

  it("lets only a Super Admin grant and revoke individual permissions", async () => {
    const superAdmin = await register("owner@example.com", "Owner Account");
    const admin = await register("admin@example.com", "Admin Account");
    const manager = await register("manager@example.com", "Content Manager");
    const student = await register("student@example.com", "Student Account");
    await forceRole(superAdmin.userId, "SUPER_ADMIN");
    await forceRole(admin.userId, "ADMIN");
    await forceRole(manager.userId, "CONTENT_MANAGER");

    const rejected = await grantAdminPermission({
      actorId: admin.userId,
      userId: manager.userId,
      permission: "USERS_MANAGE",
    });
    expect(rejected).toEqual({ ok: false, reason: "forbidden" });

    const self = await grantAdminPermission({
      actorId: superAdmin.userId,
      userId: superAdmin.userId,
      permission: "USERS_MANAGE",
    });
    expect(self).toEqual({ ok: false, reason: "self" });

    const invalidTarget = await grantAdminPermission({
      actorId: superAdmin.userId,
      userId: student.userId,
      permission: "USERS_MANAGE",
    });
    expect(invalidTarget).toEqual({ ok: false, reason: "invalid_target" });

    const granted = await grantAdminPermission({
      actorId: superAdmin.userId,
      userId: manager.userId,
      permission: "USERS_MANAGE",
    });
    expect(granted).toEqual({ ok: true, changed: true });

    const duplicate = await grantAdminPermission({
      actorId: superAdmin.userId,
      userId: manager.userId,
      permission: "USERS_MANAGE",
    });
    expect(duplicate).toEqual({ ok: true, changed: false });

    const audit = await db.auditEvent.findFirst({
      where: {
        action: "admin.permission_granted",
        entityId: manager.userId,
      },
    });
    expect(audit?.metadata).toMatchObject({ permission: "USERS_MANAGE" });

    const revoked = await revokeAdminPermission({
      actorId: superAdmin.userId,
      userId: manager.userId,
      permission: "USERS_MANAGE",
    });
    expect(revoked).toEqual({ ok: true, changed: true });

    const grantAfterRevoke = await db.adminPermissionGrant.findUnique({
      where: {
        userId_permission: {
          userId: manager.userId,
          permission: "USERS_MANAGE",
        },
      },
    });
    expect(grantAfterRevoke).toBeNull();
  });
});
