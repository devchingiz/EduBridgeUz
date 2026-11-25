import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { beginMfaEnrollment, confirmMfaEnrollment } from "@/lib/auth/mfa";
import { generateTotpCode } from "@/lib/auth/totp";
import { deleteAccount, registerAccount } from "@/lib/auth/service";
import type { RegisterInput } from "@/lib/validation/auth";

const PASSWORD = "Correct-Horse-Battery-9";

async function registerAdult(): Promise<string> {
  const input: RegisterInput = {
    name: "Deletion Test Student",
    email: `delete-${randomUUID()}@example.com`,
    password: PASSWORD,
    confirmPassword: PASSWORD,
    dateOfBirth: "2002-05-12",
    guardianName: "",
    guardianEmail: "",
    acceptTerms: true,
  };
  const result = await registerAccount(input);
  if (!result.ok) throw new Error(`registration failed: ${result.reason}`);
  return result.userId;
}

describe("account deletion data scrubbing", () => {
  it("removes all user-owned data and strips privileges", async () => {
    const userId = await registerAdult();
    const otherUserId = await registerAdult();

    const enrollment = await beginMfaEnrollment(userId);
    if (!enrollment) throw new Error("enrollment failed");
    expect(
      await confirmMfaEnrollment(userId, generateTotpCode(enrollment.secret)),
    ).toBe(true);

    await db.googleAccount.create({
      data: { subject: randomUUID(), userId },
    });
    await db.consentRecord.create({
      data: { userId, type: "TERMS", version: "2026-01" },
    });
    await db.adminPermissionGrant.create({
      data: { userId, permission: "SCHOLARSHIPS_READ" },
    });
    await db.adminPermissionGrant.create({
      data: {
        userId: otherUserId,
        permission: "UNIVERSITIES_READ",
        grantedById: userId,
      },
    });
    await db.universityComparison.create({
      data: { userId, universityIds: [] },
    });
    await db.studyNote.create({
      data: { userId, title: "Private note", body: "Do not retain this." },
    });

    const conversation = await db.advisorConversation.create({
      data: { userId, title: "Private conversation" },
    });
    await db.advisorMessage.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: "Private prompt",
      },
    });
    await db.advisorUsage.create({
      data: {
        userId,
        conversationId: conversation.id,
        provider: "test",
        model: "test-model",
        outcome: "SUCCESS",
      },
    });

    expect(await deleteAccount(userId, PASSWORD)).toEqual({ ok: true });

    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        email: true,
        name: true,
        passwordHash: true,
        mfaSecret: true,
        mfaEnabledAt: true,
        role: true,
        dateOfBirth: true,
        emailVerifiedAt: true,
        deletedAt: true,
      },
    });
    expect(user).toMatchObject({
      email: `deleted+${userId}@edubridge.invalid`,
      name: "Deleted account",
      passwordHash: null,
      mfaSecret: null,
      mfaEnabledAt: null,
      role: "STUDENT",
      dateOfBirth: null,
      emailVerifiedAt: null,
    });
    expect(user.deletedAt).toBeInstanceOf(Date);

    expect(await db.googleAccount.count({ where: { userId } })).toBe(0);
    expect(await db.consentRecord.count({ where: { userId } })).toBe(0);
    expect(await db.mfaRecoveryCode.count({ where: { userId } })).toBe(0);
    expect(await db.universityComparison.count({ where: { userId } })).toBe(0);
    expect(await db.studyNote.count({ where: { userId } })).toBe(0);
    expect(await db.advisorUsage.count({ where: { userId } })).toBe(0);
    expect(await db.advisorConversation.count({ where: { userId } })).toBe(0);
    expect(
      await db.advisorMessage.count({
        where: { conversationId: conversation.id },
      }),
    ).toBe(0);

    expect(await db.adminPermissionGrant.count({ where: { userId } })).toBe(0);
    const othersGrant = await db.adminPermissionGrant.findFirstOrThrow({
      where: { userId: otherUserId, permission: "UNIVERSITIES_READ" },
      select: { grantedById: true },
    });
    expect(othersGrant.grantedById).toBeNull();

    const audit = await db.auditEvent.findFirst({
      where: {
        action: "account.deleted",
        entityType: "User",
        entityId: userId,
      },
    });
    expect(audit).not.toBeNull();
  });
});
