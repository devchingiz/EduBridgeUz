import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { deleteAccount } from "@/lib/auth/service";
import { hashPassword } from "@/lib/security/password";
import {
  createApplication,
  getOwnedDocument,
  linkDocumentToApplication,
  listWorkspaceNotifications,
  setApplicationStatus,
  setNotificationPreferences,
  updateApplication,
} from "@/lib/workspace/service";

let studentId = "";
let otherStudentId = "";
let universityId = "";
beforeEach(async () => {
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "StudentNotification", "NotificationPreference", "ApplicationDocument", "StudentDocument", "ApplicationStatusEvent", "Application", "UniversityFavorite", "ScholarshipFavorite", "CatalogReview", "Requirement", "TuitionFact", "DeadlineFact", "Program", "Scholarship", "University", "SourceCitation", "AuditEvent", "RateLimitCounter", "ConsentRecord", "AuthToken", "Session", "StudentProfile", "User" RESTART IDENTITY CASCADE',
  );

  const [student, otherStudent] = await Promise.all([
    db.user.create({
      data: {
        email: "student@example.test",
        name: "Student",
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    }),
    db.user.create({
      data: {
        email: "other@example.test",
        name: "Other Student",
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    }),
  ]);
  studentId = student.id;
  otherStudentId = otherStudent.id;

  const citation = await db.sourceCitation.create({
    data: {
      url: "https://example.edu/admissions",
      publisher: "Example University",
      title: "Admissions",
      accessedAt: new Date("2026-11-16T00:00:00.000Z"),
      verifiedAt: new Date("2026-11-16T00:00:00.000Z"),
    },
    select: { id: true },
  });
  const university = await db.university.create({
    data: {
      slug: "example-university",
      name: "Example University",
      city: "Berlin",
      countryCode: "DE",
      websiteUrl: "https://example.edu/",
      verificationStatus: "VERIFIED",
      lastVerifiedAt: new Date("2026-11-16T00:00:00.000Z"),
      primarySourceId: citation.id,
    },
    select: { id: true },
  });
  universityId = university.id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("student application workspace", () => {
  it("tracks status transitions, progress, and preference-aware updates", async () => {
    const created = await createApplication(studentId, {
      universityId,
      status: "INTERESTED",
      notes: "Check the official admissions page",
      deadline: new Date("2027-01-15T00:00:00.000Z"),
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await setNotificationPreferences(studentId, {
      deadlines: true,
      applicationStatus: false,
      missingDocuments: true,
      scholarshipAnnouncements: true,
    });
    expect(
      await updateApplication(studentId, created.id, {
        status: "PREPARING_DOCUMENTS",
        notes: "Request transcript",
        deadline: new Date("2027-01-15T00:00:00.000Z"),
        progress: 35,
      }),
    ).toBe(true);

    const application = await db.application.findFirstOrThrow({
      where: { id: created.id, userId: studentId },
      include: { statusEvents: { orderBy: { createdAt: "asc" } } },
    });
    expect(application.status).toBe("PREPARING_DOCUMENTS");
    expect(application.progress).toBe(35);
    expect(application.statusEvents.map((event) => event.toStatus)).toEqual([
      "INTERESTED",
      "PREPARING_DOCUMENTS",
    ]);
    expect(
      await db.studentNotification.count({ where: { userId: studentId } }),
    ).toBe(1);
    expect(
      (await listWorkspaceNotifications(studentId)).some(
        (notification) => notification.type === "APPLICATION_STATUS",
      ),
    ).toBe(false);
  });

  it("changes only the status from the board and records one transition", async () => {
    const created = await createApplication(studentId, {
      universityId,
      status: "INTERESTED",
      notes: "Keep this note",
      deadline: new Date("2027-02-01T00:00:00.000Z"),
    });
    if (!created.ok) throw new Error("Application setup failed.");

    await updateApplication(studentId, created.id, {
      status: "PREPARING_DOCUMENTS",
      notes: "Keep this note",
      deadline: new Date("2027-02-01T00:00:00.000Z"),
      progress: 42,
    });

    expect(
      await setApplicationStatus(studentId, created.id, "READY_TO_APPLY"),
    ).toBe(true);
    expect(
      await setApplicationStatus(otherStudentId, created.id, "SUBMITTED"),
    ).toBe(false);
    expect(
      await setApplicationStatus(studentId, created.id, "READY_TO_APPLY"),
    ).toBe(true);

    const application = await db.application.findFirstOrThrow({
      where: { id: created.id, userId: studentId },
      include: { statusEvents: { orderBy: { createdAt: "asc" } } },
    });
    expect(application.status).toBe("READY_TO_APPLY");
    expect(application.notes).toBe("Keep this note");
    expect(application.progress).toBe(42);
    expect(application.deadline).toEqual(new Date("2027-02-01T00:00:00.000Z"));
    expect(application.statusEvents.map((event) => event.toStatus)).toEqual([
      "INTERESTED",
      "PREPARING_DOCUMENTS",
      "READY_TO_APPLY",
    ]);
  });

  it("does not allow another student to read or link private documents", async () => {
    const created = await createApplication(studentId, {
      universityId,
      status: "INTERESTED",
      notes: "",
      deadline: null,
    });
    if (!created.ok) throw new Error("Application setup failed.");

    const document = await db.studentDocument.create({
      data: {
        userId: studentId,
        name: "Transcript",
        category: "ACADEMIC_TRANSCRIPT",
        storageKey: "00000000-0000-4000-8000-000000000001.pdf",
        mimeType: "application/pdf",
        sizeBytes: 16,
      },
      select: { id: true },
    });

    expect(await getOwnedDocument(studentId, document.id)).not.toBeNull();
    expect(
      await linkDocumentToApplication(studentId, document.id, created.id, true),
    ).toBe(true);
    expect(await getOwnedDocument(otherStudentId, document.id)).toBeNull();
    expect(
      await linkDocumentToApplication(
        otherStudentId,
        document.id,
        created.id,
        true,
      ),
    ).toBe(false);
    expect(await db.applicationDocument.count()).toBe(1);
  });

  it("prevents duplicate applications for the same university", async () => {
    const input = {
      universityId,
      status: "INTERESTED" as const,
      notes: "",
      deadline: null,
    };
    const results = await Promise.all([
      createApplication(studentId, input),
      createApplication(studentId, input),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([
      { ok: false, reason: "duplicate" },
    ]);
  });

  it("removes private file bytes and workspace rows on account deletion", async () => {
    const application = await createApplication(studentId, {
      universityId,
      status: "INTERESTED",
      notes: "",
      deadline: null,
    });
    if (!application.ok) throw new Error("Application setup failed.");

    const storageKey = `${randomUUID()}.pdf`;
    const bytes = Buffer.from("%PDF-1.7\nprivate test");
    await db.studentDocument.create({
      data: {
        userId: studentId,
        name: "Private transcript",
        category: "ACADEMIC_TRANSCRIPT",
        storageKey,
        mimeType: "application/pdf",
        sizeBytes: bytes.length,
      },
    });
    await db.user.update({
      where: { id: studentId },
      data: { passwordHash: await hashPassword("Strong-Test-Password-42") },
    });

    const cleanup = vi.fn(async () => {});
    expect(
      await deleteAccount(studentId, "Strong-Test-Password-42", {
        documentCleanup: cleanup,
      }),
    ).toEqual({ ok: true });
    expect(cleanup).toHaveBeenCalledWith(storageKey);
    expect(await db.application.count({ where: { userId: studentId } })).toBe(
      0,
    );
    expect(
      await db.studentDocument.count({ where: { userId: studentId } }),
    ).toBe(0);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: studentId } })).deletedAt,
    ).not.toBeNull();
  });

  it("preserves account data when private object deletion fails", async () => {
    const storageKey = `${randomUUID()}.pdf`;
    await db.studentDocument.create({
      data: {
        userId: studentId,
        name: "Private transcript",
        category: "ACADEMIC_TRANSCRIPT",
        storageKey,
        mimeType: "application/pdf",
        sizeBytes: 16,
      },
    });
    await db.user.update({
      where: { id: studentId },
      data: { passwordHash: await hashPassword("Strong-Test-Password-42") },
    });

    await expect(
      deleteAccount(studentId, "Strong-Test-Password-42", {
        documentCleanup: async () => {
          throw new Error("storage unavailable");
        },
      }),
    ).rejects.toThrow("storage unavailable");
    expect(
      await db.studentDocument.count({ where: { userId: studentId } }),
    ).toBe(1);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: studentId } })).deletedAt,
    ).toBeNull();
  });
});
