import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { executeAdvisorTool } from "@/lib/advisor/tools";
import {
  ADMIN_UNIVERSITY_PAGE_SIZE,
  listAdminUniversities,
  setAdminUniversityStatus,
} from "@/lib/admin/universities";
import type { VerificationStatusValue } from "@/lib/catalog/constants";
import { getUniversityBySlug } from "@/lib/catalog/queries";
import { recordDecision, type Reviewer } from "@/lib/catalog/review-service";
import { db } from "@/lib/db";

const VERIFIED_DATE = new Date("2026-11-16T00:00:00.000Z");

type Classification = {
  slug: string;
  name: string;
  ranking: string | null;
  category: "Reach" | "Target" | "Likely";
  reason: string;
  indicativeAnnualTuition: string | null;
  budgetComparable: boolean;
  missingFacts: string[];
  disclosure?: string;
};

type ClassificationPayload = {
  count: number;
  classifications: Classification[];
  disclosure: string;
  basedOn: {
    targetDegree: string | null;
    fieldsOfStudy: string[];
    budget: string | null;
  };
};

function asClassificationPayload(data: unknown): ClassificationPayload {
  if (!data || typeof data !== "object" || !("classifications" in data)) {
    throw new Error("Expected a classification payload.");
  }
  return data as ClassificationPayload;
}

let studentId = "";
let otherStudentId = "";
let adminId = "";
let reviewer: Reviewer;
let universityIds: Record<string, string> = {};
const sourceUrls: Record<string, string> = {};

async function createSource(slug: string) {
  const url = `https://${slug}.example.edu/`;
  sourceUrls[slug] = url;
  return db.sourceCitation.create({
    data: {
      url,
      publisher: `${slug} University`,
      title: `${slug} official profile`,
      accessedAt: VERIFIED_DATE,
      verifiedAt: VERIFIED_DATE,
    },
    select: { id: true },
  });
}

async function createRankedUniversity(input: {
  slug: string;
  rank: number | null;
  rankDisplay: string;
  tuitionMinor: number;
  status?: VerificationStatusValue;
}) {
  const source = await createSource(input.slug);
  const university = await db.university.create({
    data: {
      slug: input.slug,
      name: `${input.slug} University`,
      city: "Berlin",
      countryCode: "DE",
      websiteUrl: sourceUrls[input.slug],
      rankingOrganization: "QS",
      rankingEdition: "2027",
      rankingPosition: input.rank,
      rankingDisplay: input.rankDisplay,
      rankingTied: input.rankDisplay.startsWith("="),
      rankingIsRange: input.rankDisplay.includes("-"),
      verificationStatus: input.status ?? "VERIFIED",
      lastVerifiedAt: VERIFIED_DATE,
      primarySourceId: source.id,
    },
    select: { id: true },
  });

  if (!input.status || input.status === "VERIFIED") {
    const program = await db.program.create({
      data: {
        universityId: university.id,
        slug: `${input.slug}-msc-cs`,
        name: "MSc Computer Science",
        degreeLevel: "MASTER",
        field: "Computer Science",
        language: "English",
        verificationStatus: "VERIFIED",
        lastVerifiedAt: VERIFIED_DATE,
        primarySourceId: source.id,
      },
      select: { id: true },
    });
    await db.tuitionFact.create({
      data: {
        programId: program.id,
        amountMinor: input.tuitionMinor,
        currency: "EUR",
        period: "per year",
        applicantGroup: "International students",
        verificationStatus: "VERIFIED",
        sourceId: source.id,
      },
    });
  }

  return university.id;
}

beforeEach(async () => {
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "StudyNote", "UniversityComparison", "AdvisorUsage", "AdvisorMessage", "AdvisorConversation", "StudentNotification", "NotificationPreference", "ApplicationDocument", "StudentDocument", "ApplicationStatusEvent", "Application", "UniversityFavorite", "ScholarshipFavorite", "ProgramScholarship", "ProgramIntake", "ProgramCost", "CatalogFieldFact", "CatalogReview", "Requirement", "TuitionFact", "DeadlineFact", "Program", "Scholarship", "University", "SourceCitation", "AuditEvent", "RateLimitCounter", "ConsentRecord", "AuthToken", "Session", "StudentProfile", "User" RESTART IDENTITY CASCADE',
  );

  const [student, other, admin, catalogReviewer] = await Promise.all([
    db.user.create({
      data: {
        email: "classify-student@example.test",
        name: "Classification Student",
      },
      select: { id: true },
    }),
    db.user.create({
      data: { email: "classify-other@example.test", name: "Other Student" },
      select: { id: true },
    }),
    db.user.create({
      data: {
        email: "catalog-admin@example.test",
        name: "Catalog Admin",
        role: "ADMIN",
      },
      select: { id: true },
    }),
    db.user.create({
      data: {
        email: "catalog-reviewer@example.test",
        name: "Catalog Reviewer",
        role: "REVIEWER",
      },
      select: { id: true },
    }),
  ]);
  studentId = student.id;
  otherStudentId = other.id;
  adminId = admin.id;
  reviewer = { id: catalogReviewer.id, ip: "127.0.0.1" };

  await db.studentProfile.create({
    data: {
      userId: studentId,
      nationality: "DE",
      residenceCountry: "DE",
      targetDegree: "MASTER",
      fieldsOfStudy: ["Computer Science"],
      budgetAmount: 15_000,
      budgetCurrency: "EUR",
      onboardingCompletedAt: VERIFIED_DATE,
    },
  });

  universityIds = {
    reach: await createRankedUniversity({
      slug: "reach-u",
      rank: 50,
      rankDisplay: "=50",
      tuitionMinor: 1_000_000,
    }),
    target: await createRankedUniversity({
      slug: "target-u",
      rank: 150,
      rankDisplay: "150-200",
      tuitionMinor: 1_200_000,
    }),
    likely: await createRankedUniversity({
      slug: "likely-u",
      rank: 600,
      rankDisplay: "=600",
      tuitionMinor: 1_100_000,
    }),
    hidden: await createRankedUniversity({
      slug: "hidden-u",
      rank: 1,
      rankDisplay: "1",
      tuitionMinor: 500_000,
      status: "UNVERIFIED",
    }),
  };

  await db.universityFavorite.createMany({
    data: [
      { userId: studentId, universityId: universityIds.reach },
      { userId: studentId, universityId: universityIds.target },
    ],
  });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("DB-grounded advisor classification", () => {
  it("classifies only visible catalog records using stored rank and tuition facts", async () => {
    const result = await executeAdvisorTool(
      studentId,
      "classify_shortlist",
      JSON.stringify({
        slugs: ["reach-u", "target-u", "likely-u", "hidden-u", "missing-u"],
      }),
    );
    const payload = asClassificationPayload(result.data);

    expect(payload.count).toBe(3);
    expect(
      payload.classifications.map((item) => [item.slug, item.category]),
    ).toEqual([
      ["reach-u", "Reach"],
      ["target-u", "Target"],
      ["likely-u", "Likely"],
    ]);
    expect(payload.classifications[0].reason).toContain("=50");
    expect(payload.classifications[0].indicativeAnnualTuition).toMatch(
      /10,000/,
    );
    expect(payload.classifications.every((item) => item.budgetComparable)).toBe(
      true,
    );
    expect(payload.basedOn).toMatchObject({
      targetDegree: "MASTER",
      fieldsOfStudy: ["Computer Science"],
      budget: "15000 EUR",
    });
    expect(payload.disclosure).toMatch(/not.*guarantee/i);
    expect(payload.classifications[0].disclosure).toBeUndefined();

    expect(result.sources.map((source) => source.url).sort()).toEqual(
      [
        sourceUrls["reach-u"],
        sourceUrls["target-u"],
        sourceUrls["likely-u"],
      ].sort(),
    );
    expect(JSON.stringify(result)).not.toContain(sourceUrls["hidden-u"]);
  });

  it("falls back to the student's saved universities when no slugs are supplied", async () => {
    const result = await executeAdvisorTool(
      studentId,
      "classify_shortlist",
      "{}",
    );
    const payload = asClassificationPayload(result.data);

    expect(payload.count).toBe(2);
    expect(new Set(payload.classifications.map((item) => item.slug))).toEqual(
      new Set(["reach-u", "target-u"]),
    );
  });

  it("reports an empty shortlist instead of inventing universities", async () => {
    const result = await executeAdvisorTool(
      otherStudentId,
      "classify_shortlist",
      "{}",
    );

    expect(result.data).toMatchObject({ error: "no_universities" });
    expect(result.sources).toEqual([]);
  });

  it("rejects an injected user id with strict schema validation", async () => {
    const result = await executeAdvisorTool(
      studentId,
      "classify_shortlist",
      JSON.stringify({ slugs: ["reach-u"], userId: otherStudentId }),
    );

    expect(result.data).toMatchObject({ error: "invalid_arguments" });
    expect(result.sources).toEqual([]);
  });
});

describe("explicit review decisions", () => {
  it("marks a source-backed record partially verified without hiding it", async () => {
    const decision = await recordDecision({
      entityType: "UNIVERSITY",
      id: universityIds.reach,
      decision: "MARK_PARTIAL",
      note: "QS data only; official page not checked.",
      reviewer,
    });
    expect(decision.ok).toBe(true);

    const row = await db.university.findUniqueOrThrow({
      where: { id: universityIds.reach },
    });
    expect(row.verificationStatus).toBe("PARTIALLY_VERIFIED");
    expect(await getUniversityBySlug("reach-u")).not.toBeNull();

    const review = await db.catalogReview.findFirst({
      where: { entityId: universityIds.reach, decision: "MARK_PARTIAL" },
    });
    expect(review).toMatchObject({
      fromStatus: "VERIFIED",
      toStatus: "PARTIALLY_VERIFIED",
      note: "QS data only; official page not checked.",
    });

    const audit = await db.auditEvent.findFirst({
      where: { entityId: universityIds.reach, action: "catalog.mark_partial" },
    });
    expect(audit?.actorId).toBe(reviewer.id);
  });

  it("marks a record information unavailable and hides it from the public catalog", async () => {
    const decision = await recordDecision({
      entityType: "UNIVERSITY",
      id: universityIds.target,
      decision: "MARK_UNAVAILABLE",
      note: "Source withdrawn; no trustworthy value remains.",
      reviewer,
    });
    expect(decision.ok).toBe(true);

    const row = await db.university.findUniqueOrThrow({
      where: { id: universityIds.target },
    });
    expect(row.verificationStatus).toBe("INFORMATION_UNAVAILABLE");
    expect(await getUniversityBySlug("target-u")).toBeNull();

    const review = await db.catalogReview.findFirst({
      where: { entityId: universityIds.target, decision: "MARK_UNAVAILABLE" },
    });
    expect(review?.toStatus).toBe("INFORMATION_UNAVAILABLE");

    const audit = await db.auditEvent.findFirst({
      where: {
        entityId: universityIds.target,
        action: "catalog.mark_unavailable",
      },
    });
    expect(audit?.actorId).toBe(reviewer.id);
  });
});

describe("administrative university management", () => {
  it("searches and filters catalog records", async () => {
    const all = await listAdminUniversities({
      query: "",
      status: null,
      page: 1,
    });
    expect(all.total).toBe(4);
    expect(all.page).toBe(1);
    expect(all.pageCount).toBe(1);
    expect(all.items).toHaveLength(4);
    expect(all.items[0]).toMatchObject({
      slug: expect.any(String),
      programCount: expect.any(Number),
      status: expect.any(String),
    });

    const searched = await listAdminUniversities({
      query: "target",
      status: null,
      page: 1,
    });
    expect(searched.items.map((item) => item.slug)).toEqual(["target-u"]);

    const byStatus = await listAdminUniversities({
      query: "",
      status: "UNVERIFIED",
      page: 1,
    });
    expect(byStatus.items.map((item) => item.slug)).toEqual(["hidden-u"]);
    expect(ADMIN_UNIVERSITY_PAGE_SIZE).toBe(20);
  });

  it("audits a status override and rejects invalid or unchanged changes", async () => {
    const changed = await setAdminUniversityStatus({
      actorId: adminId,
      universityId: universityIds.target,
      status: "NEEDS_REVIEW",
      ip: "127.0.0.1",
    });
    expect(changed).toEqual({
      ok: true,
      changed: true,
      previousStatus: "VERIFIED",
    });

    const row = await db.university.findUniqueOrThrow({
      where: { id: universityIds.target },
    });
    expect(row.verificationStatus).toBe("NEEDS_REVIEW");

    const audit = await db.auditEvent.findFirst({
      where: {
        actorId: adminId,
        entityId: universityIds.target,
        action: "admin.university_status_changed",
      },
    });
    expect(audit?.metadata).toEqual({
      fromStatus: "VERIFIED",
      toStatus: "NEEDS_REVIEW",
    });
    expect(audit?.ipHash).toBeTruthy();

    expect(
      await setAdminUniversityStatus({
        actorId: adminId,
        universityId: universityIds.target,
        status: "NEEDS_REVIEW",
      }),
    ).toEqual({ ok: false, reason: "unchanged" });
    expect(
      await setAdminUniversityStatus({
        actorId: adminId,
        universityId: "missing-university",
        status: "VERIFIED",
      }),
    ).toEqual({ ok: false, reason: "not_found" });
    expect(
      await setAdminUniversityStatus({
        actorId: adminId,
        universityId: universityIds.target,
        status: "NOT_A_STATUS" as VerificationStatusValue,
      }),
    ).toEqual({ ok: false, reason: "invalid_status" });

    expect(
      await db.auditEvent.count({
        where: { action: "admin.university_status_changed" },
      }),
    ).toBe(1);
  });
});
