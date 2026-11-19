import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
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

beforeEach(async () => {
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "GoogleOAuthAttempt", "GoogleAccount", "AuditEvent", "ConsentRecord", "AuthToken", "Session", "StudentProfile", "RateLimitCounter", "User" RESTART IDENTITY CASCADE',
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
  it("promotes a configured email on registration and on sign-in", async () => {
    process.env.BOOTSTRAP_ADMIN_EMAILS = "owner@example.com";

    const registered = await register("owner@example.com", "Owner Account");
    const promoted = await db.user.findUniqueOrThrow({
      where: { id: registered.userId },
      select: { role: true },
    });
    expect(promoted.role).toBe("ADMIN");

    const session = await validateSessionToken(registered.sessionToken);
    expect(session?.user.role).toBe("ADMIN");

    const grant = await db.auditEvent.findFirst({
      where: {
        actorId: registered.userId,
        action: "auth.bootstrap_admin",
      },
    });
    expect(grant).not.toBeNull();

    const student = await register("late@example.com", "Late Account");
    process.env.BOOTSTRAP_ADMIN_EMAILS = "owner@example.com, LATE@example.com";

    const login = await authenticate({
      email: "late@example.com",
      password: PASSWORD,
    });
    expect(login.ok).toBe(true);
    const afterLogin = await db.user.findUniqueOrThrow({
      where: { id: student.userId },
      select: { role: true },
    });
    expect(afterLogin.role).toBe("ADMIN");
  });

  it("changes roles only from an administrator actor and audits the change", async () => {
    const admin = await register("admin@example.com", "Admin Account");
    const student = await register("student@example.com", "Student Account");
    await db.user.update({
      where: { id: admin.userId },
      data: { role: "ADMIN" },
    });

    const rejected = await changeUserRole({
      actorId: student.userId,
      userId: student.userId,
      role: "ADMIN",
    });
    expect(rejected).toEqual({ ok: false, reason: "forbidden" });

    const self = await changeUserRole({
      actorId: admin.userId,
      userId: admin.userId,
      role: "STUDENT",
    });
    expect(self).toEqual({ ok: false, reason: "self" });

    const changed = await changeUserRole({
      actorId: admin.userId,
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

  it("lists accounts and revokes another user's sessions", async () => {
    const admin = await register("admin@example.com", "Admin Account");
    const student = await register("amina@example.com", "Amina Karimova");
    await db.user.update({
      where: { id: admin.userId },
      data: { role: "ADMIN" },
    });

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
});
