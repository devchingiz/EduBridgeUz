import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { getAdminOverview } from "@/lib/admin/overview";
import { db } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "AdvisorUsage", "AdvisorMessage", "AdvisorConversation", "ApplicationDocument", "ApplicationStatusEvent", "Application", "StudentDocument", "StudentNotification", "NotificationPreference", "StudyNote", "CatalogFieldFact", "CatalogReview", "ProgramScholarship", "ProgramIntake", "ProgramCost", "TuitionFact", "Requirement", "DeadlineFact", "ScholarshipFavorite", "UniversityFavorite", "Scholarship", "Program", "University", "SourceCitation", "AuditEvent", "AdminPermissionGrant", "AuthToken", "Session", "StudentProfile", "ConsentRecord", "GoogleAccount", "GoogleOAuthAttempt", "RateLimitCounter", "User" RESTART IDENTITY CASCADE',
  );
});

afterAll(async () => {
  await db.$disconnect();
});

describe("administration overview analytics", () => {
  it("derives every count and chart point from database rows", async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - DAY_MS);
    const dateOfBirth = new Date("1995-06-15");

    const [olderUser, todayUser] = await Promise.all([
      db.user.create({
        data: {
          email: "older@example.com",
          name: "Older User",
          dateOfBirth,
          emailVerifiedAt: now,
          createdAt: yesterday,
        },
      }),
      db.user.create({
        data: {
          email: "today@example.com",
          name: "Today User",
          dateOfBirth,
          createdAt: now,
        },
      }),
    ]);

    const source = await db.sourceCitation.create({
      data: {
        url: "https://example.edu/official",
        publisher: "Example University",
        title: "Official catalogue",
        accessedAt: now,
      },
    });

    const [university] = await Promise.all([
      db.university.create({
        data: {
          slug: "example-university",
          name: "Example University",
          city: "Tashkent",
          countryCode: "UZ",
          primarySourceId: source.id,
          verificationStatus: "VERIFIED",
          createdAt: yesterday,
        },
      }),
      db.scholarship.create({
        data: {
          slug: "example-scholarship",
          name: "Example Scholarship",
          providerName: "Example Foundation",
          providerUrl: "https://example.org/scholarship",
          fundingType: "PARTIAL",
          degreeLevels: ["BACHELOR"],
          summary: "A sourced test scholarship.",
          primarySourceId: source.id,
          verificationStatus: "PARTIALLY_VERIFIED",
          createdAt: now,
        },
      }),
    ]);

    await Promise.all([
      db.application.create({
        data: {
          userId: olderUser.id,
          universityId: university.id,
          status: "SUBMITTED",
          createdAt: now,
        },
      }),
      db.auditEvent.create({
        data: {
          actorId: olderUser.id,
          action: "test.event",
          entityType: "Test",
          entityId: "1",
          createdAt: now,
        },
      }),
      db.advisorUsage.create({
        data: {
          userId: todayUser.id,
          provider: "test-provider",
          model: "test-model",
          totalTokens: 100,
          estimatedCostMicros: 250_000,
          outcome: "SUCCESS",
          createdAt: now,
        },
      }),
    ]);

    const overview = await getAdminOverview();

    expect(overview.totalUsers).toBe(2);
    expect(overview.verifiedUsers).toBe(1);
    expect(overview.totals.universities).toBe(1);
    expect(overview.totals.scholarships).toBe(1);
    expect(overview.totals.applications).toBe(1);
    expect(overview.totals.advisorRequests).toBe(1);
    expect(overview.totals.estimatedAdvisorCostUsd).toBe(0.25);
    expect(overview.catalogHealth.citationsWithoutVerification).toBe(1);

    expect(
      overview.universityStatuses.find((item) => item.status === "VERIFIED")
        ?.count,
    ).toBe(1);
    expect(
      overview.scholarshipStatuses.find(
        (item) => item.status === "PARTIALLY_VERIFIED",
      )?.count,
    ).toBe(1);
    expect(
      overview.applicationStatuses.find((item) => item.status === "SUBMITTED")
        ?.count,
    ).toBe(1);

    const last = overview.trend.at(-1);
    expect(last?.accounts).toBe(1);
    expect(last?.applications).toBe(1);
    expect(last?.auditEvents).toBe(1);
    expect(last?.advisorRequests).toBe(1);
    expect(overview.trend.at(-2)?.accounts).toBe(1);
    expect(overview.trend.at(-2)?.applications).toBe(0);
    expect(overview.recentEvents[0]?.action).toBe("test.event");
  });
});
