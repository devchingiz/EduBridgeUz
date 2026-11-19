import "server-only";

import {
  ApplicationStatus,
  Prisma,
  StudentDocumentCategory,
  StudentNotificationType,
} from "@prisma/client";

import { PUBLIC_VISIBLE_STATUSES } from "@/lib/catalog/constants";
import { db } from "@/lib/db";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
} from "@/lib/workspace/constants";
import { removePrivateDocument } from "@/lib/workspace/storage";

export async function listApplications(userId: string) {
  return db.application.findMany({
    where: { userId },
    include: {
      university: {
        select: { id: true, name: true, city: true, countryCode: true },
      },
      documents: {
        include: {
          document: { select: { id: true, name: true, isComplete: true } },
        },
      },
    },
    orderBy: [{ deadline: "asc" }, { updatedAt: "desc" }],
  });
}

export async function createApplication(
  userId: string,
  input: {
    universityId: string;
    status: ApplicationStatus;
    notes: string;
    deadline: Date | null;
  },
) {
  const university = await db.university.findFirst({
    where: {
      id: input.universityId,
      verificationStatus: { in: [...PUBLIC_VISIBLE_STATUSES] },
    },
    select: { id: true },
  });
  if (!university)
    return { ok: false as const, reason: "unavailable" as const };

  const existing = await db.application.findUnique({
    where: {
      userId_universityId: { userId, universityId: input.universityId },
    },
    select: { id: true },
  });
  if (existing) return { ok: false as const, reason: "duplicate" as const };

  try {
    const application = await db.$transaction(async (tx) => {
      const created = await tx.application.create({
        data: { userId, ...input },
      });
      await recordStatusChange(
        tx,
        userId,
        created.id,
        null,
        input.status,
        true,
      );
      return created;
    });
    return { ok: true as const, id: application.id };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false as const, reason: "duplicate" as const };
    }
    throw error;
  }
}

export async function updateApplication(
  userId: string,
  applicationId: string,
  input: {
    status: ApplicationStatus;
    notes: string;
    deadline: Date | null;
    progress: number;
  },
) {
  const existing = await db.application.findFirst({
    where: { id: applicationId, userId },
    select: { id: true, status: true },
  });
  if (!existing) return false;

  await db.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: existing.id },
      data: input,
    });
    await recordStatusChange(
      tx,
      userId,
      existing.id,
      existing.status,
      input.status,
      false,
    );
  });
  return true;
}

/** Board-level status change that preserves notes, deadline, and progress. */
export async function setApplicationStatus(
  userId: string,
  applicationId: string,
  status: ApplicationStatus,
): Promise<boolean> {
  const existing = await db.application.findFirst({
    where: { id: applicationId, userId },
    select: { id: true, status: true },
  });
  if (!existing) return false;
  if (existing.status === status) return true;

  await db.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: existing.id },
      data: { status },
    });
    await recordStatusChange(
      tx,
      userId,
      existing.id,
      existing.status,
      status,
      false,
    );
  });
  return true;
}

export async function setApplicationDeadline(
  userId: string,
  universityId: string,
  deadline: Date,
): Promise<boolean> {
  const result = await db.application.updateMany({
    where: { userId, universityId },
    data: { deadline },
  });
  return result.count > 0;
}

async function recordStatusChange(
  tx: Prisma.TransactionClient,
  userId: string,
  applicationId: string,
  fromStatus: ApplicationStatus | null,
  toStatus: ApplicationStatus,
  isNew: boolean,
) {
  if (!isNew && fromStatus === toStatus) return;

  await tx.applicationStatusEvent.create({
    data: { applicationId, fromStatus, toStatus },
  });
  await writeApplicationNotification(
    tx,
    userId,
    applicationId,
    toStatus,
    isNew,
  );
}

async function writeApplicationNotification(
  tx: Prisma.TransactionClient,
  userId: string,
  applicationId: string,
  status: ApplicationStatus,
  isNew: boolean,
) {
  const preference = await tx.notificationPreference.findUnique({
    where: { userId },
    select: { applicationStatus: true },
  });
  if (preference?.applicationStatus === false) return;

  const application = await tx.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { university: { select: { name: true } } },
  });
  await tx.studentNotification.create({
    data: {
      userId,
      type: StudentNotificationType.APPLICATION_STATUS,
      title: isNew ? "Application added" : "Application status updated",
      body: `${application.university.name}: ${labelStatus(status)}.`,
      href: `/dashboard/applications/${applicationId}`,
    },
  });
}

function labelStatus(status: ApplicationStatus): string {
  return APPLICATION_STATUS_LABELS[status];
}

export async function deleteApplication(
  userId: string,
  applicationId: string,
): Promise<boolean> {
  const result = await db.application.deleteMany({
    where: { id: applicationId, userId },
  });
  return result.count > 0;
}

export async function getApplication(userId: string, applicationId: string) {
  return db.application.findFirst({
    where: { id: applicationId, userId },
    include: {
      university: {
        select: { id: true, name: true, city: true, countryCode: true },
      },
      documents: { include: { document: true } },
      statusEvents: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function listWorkspaceUniversities() {
  return db.university.findMany({
    where: { verificationStatus: { in: [...PUBLIC_VISIBLE_STATUSES] } },
    select: { id: true, name: true, city: true, countryCode: true },
    orderBy: { name: "asc" },
  });
}

export async function listDocuments(userId: string) {
  return db.studentDocument.findMany({
    where: { userId },
    include: {
      applications: {
        include: {
          application: {
            select: { id: true, university: { select: { name: true } } },
          },
        },
      },
    },
    orderBy: [{ category: "asc" }, { updatedAt: "desc" }],
  });
}

export async function updateDocument(
  userId: string,
  documentId: string,
  input: {
    name: string;
    category: StudentDocumentCategory;
    isComplete: boolean;
  },
): Promise<boolean> {
  const result = await db.studentDocument.updateMany({
    where: { id: documentId, userId },
    data: input,
  });
  return result.count > 0;
}

export async function linkDocumentToApplication(
  userId: string,
  documentId: string,
  applicationId: string,
  linked: boolean,
): Promise<boolean> {
  const [document, application] = await Promise.all([
    db.studentDocument.findFirst({
      where: { id: documentId, userId },
      select: { id: true },
    }),
    db.application.findFirst({
      where: { id: applicationId, userId },
      select: { id: true },
    }),
  ]);
  if (!document || !application) return false;

  if (linked) {
    await db.applicationDocument.upsert({
      where: { applicationId_documentId: { applicationId, documentId } },
      create: { applicationId, documentId },
      update: {},
    });
  } else {
    await db.applicationDocument.deleteMany({
      where: { applicationId, documentId },
    });
  }
  return true;
}

export async function deleteDocument(
  userId: string,
  documentId: string,
): Promise<boolean> {
  const document = await db.studentDocument.findFirst({
    where: { id: documentId, userId },
    select: { id: true, storageKey: true },
  });
  if (!document) return false;

  await removePrivateDocument(document.storageKey);
  await db.studentDocument.delete({ where: { id: document.id } });
  return true;
}

export async function getOwnedDocument(userId: string, documentId: string) {
  return db.studentDocument.findFirst({
    where: { id: documentId, userId },
    select: {
      id: true,
      name: true,
      storageKey: true,
      mimeType: true,
      sizeBytes: true,
    },
  });
}

export async function getNotificationPreferences(userId: string) {
  const saved = await db.notificationPreference.findUnique({
    where: { userId },
    select: {
      deadlines: true,
      applicationStatus: true,
      missingDocuments: true,
      scholarshipAnnouncements: true,
    },
  });
  return (
    saved ?? {
      deadlines: true,
      applicationStatus: true,
      missingDocuments: true,
      scholarshipAnnouncements: true,
    }
  );
}

export async function setNotificationPreferences(
  userId: string,
  input: {
    deadlines: boolean;
    applicationStatus: boolean;
    missingDocuments: boolean;
    scholarshipAnnouncements: boolean;
  },
) {
  return db.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...input },
    update: input,
  });
}

export async function markNotificationRead(
  userId: string,
  notificationId: string,
) {
  const result = await db.studentNotification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count > 0;
}

export async function listWorkspaceNotifications(userId: string) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const deadlineWindow = new Date(today.getTime() + 30 * 86400000);
  const [preferences, stored, deadlines, missingDocuments, scholarships] =
    await Promise.all([
      getNotificationPreferences(userId),
      db.studentNotification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      db.application.findMany({
        where: {
          userId,
          deadline: { gte: today, lte: deadlineWindow },
          status: { notIn: ["ACCEPTED", "REJECTED"] },
        },
        include: { university: { select: { name: true } } },
        orderBy: { deadline: "asc" },
      }),
      db.studentDocument.count({ where: { userId, isComplete: false } }),
      db.scholarship.findMany({
        where: {
          verificationStatus: { in: [...PUBLIC_VISIBLE_STATUSES] },
          createdAt: { gte: new Date(Date.now() - 14 * 86400000) },
        },
        select: { id: true, slug: true, name: true, providerName: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

  const visibleStored = stored.filter((notification) => {
    if (notification.type === StudentNotificationType.DEADLINE) {
      return preferences.deadlines;
    }
    if (notification.type === StudentNotificationType.APPLICATION_STATUS) {
      return preferences.applicationStatus;
    }
    if (notification.type === StudentNotificationType.MISSING_DOCUMENT) {
      return preferences.missingDocuments;
    }
    return preferences.scholarshipAnnouncements;
  });

  const dynamic = [
    ...(preferences.deadlines
      ? deadlines.map((application) => ({
          id: `deadline-${application.id}`,
          type: StudentNotificationType.DEADLINE,
          title: "Application deadline coming up",
          body: `${application.university.name} deadline: ${application.deadline?.toISOString().slice(0, 10)}.`,
          href: `/dashboard/applications/${application.id}`,
          readAt: null,
          createdAt: application.updatedAt,
        }))
      : []),
    ...(preferences.missingDocuments && missingDocuments > 0
      ? [
          {
            id: "missing-documents",
            type: StudentNotificationType.MISSING_DOCUMENT,
            title: "Review your documents",
            body: `${missingDocuments} document${missingDocuments === 1 ? "" : "s"} still need${missingDocuments === 1 ? "s" : ""} completion.`,
            href: "/dashboard/documents",
            readAt: null,
            createdAt: new Date(),
          },
        ]
      : []),
    ...(preferences.scholarshipAnnouncements
      ? scholarships.map((scholarship) => ({
          id: `scholarship-${scholarship.id}`,
          type: StudentNotificationType.SCHOLARSHIP_ANNOUNCEMENT,
          title: "New scholarship in the catalog",
          body: `${scholarship.name} · ${scholarship.providerName}.`,
          href: `/scholarships/${scholarship.slug}`,
          readAt: null,
          createdAt: new Date(),
        }))
      : []),
  ];

  return [...visibleStored, ...dynamic].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

export async function getWorkspaceAnalytics(userId: string) {
  const [applications, documents, recentEvents] = await Promise.all([
    db.application.findMany({
      where: { userId },
      select: { status: true, progress: true },
    }),
    db.studentDocument.findMany({
      where: { userId },
      select: { isComplete: true },
    }),
    db.applicationStatusEvent.findMany({
      where: { application: { userId } },
      include: {
        application: {
          select: { id: true, university: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const active = applications.filter(
    (application) => !["ACCEPTED", "REJECTED"].includes(application.status),
  ).length;
  const completedDocuments = documents.filter(
    (document) => document.isComplete,
  ).length;
  const averageProgress = applications.length
    ? Math.round(
        applications.reduce(
          (sum, application) => sum + application.progress,
          0,
        ) / applications.length,
      )
    : 0;

  return {
    totalApplications: applications.length,
    activeApplications: active,
    documentCount: documents.length,
    completedDocuments,
    averageProgress,
    statusCounts: APPLICATION_STATUSES.map((status) => ({
      status,
      count: applications.filter((application) => application.status === status)
        .length,
    })).filter((item) => item.count > 0),
    recentEvents,
  };
}

export async function getCalendarApplications(userId: string) {
  return db.application.findMany({
    where: { userId, deadline: { not: null } },
    include: {
      university: { select: { name: true, city: true, countryCode: true } },
    },
    orderBy: { deadline: "asc" },
  });
}
