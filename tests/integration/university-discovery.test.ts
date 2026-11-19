import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import {
  getUniversityDiscoveryDetail,
  listUniversityDiscovery,
} from "@/lib/catalog/discovery-queries";
import { parseUniversityDiscoveryFilters } from "@/lib/catalog/discovery-filters";
import { setCatalogFavorite } from "@/lib/catalog/favorites";
import {
  createApplication,
  setApplicationDeadline,
} from "@/lib/workspace/service";

let studentId = "";
let otherStudentId = "";
let universityId = "";
let programId = "";

beforeEach(async () => {
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "StudentNotification", "NotificationPreference", "ApplicationDocument", "StudentDocument", "ApplicationStatusEvent", "Application", "UniversityFavorite", "ScholarshipFavorite", "ProgramScholarship", "ProgramIntake", "ProgramCost", "CatalogReview", "Requirement", "TuitionFact", "DeadlineFact", "Program", "Scholarship", "University", "SourceCitation", "AuditEvent", "RateLimitCounter", "ConsentRecord", "AuthToken", "Session", "StudentProfile", "User" RESTART IDENTITY CASCADE',
  );

  const [student, other] = await Promise.all([
    db.user.create({
      data: { email: "discovery@example.test", name: "Discovery Student" },
      select: { id: true },
    }),
    db.user.create({
      data: { email: "other-discovery@example.test", name: "Other Student" },
      select: { id: true },
    }),
  ]);
  studentId = student.id;
  otherStudentId = other.id;

  const source = await db.sourceCitation.create({
    data: {
      url: "https://example.edu/program",
      publisher: "Example University",
      title: "Program and fees",
      accessedAt: new Date("2026-11-17T00:00:00.000Z"),
      verifiedAt: new Date("2026-11-17T00:00:00.000Z"),
    },
    select: { id: true },
  });
  const scholarshipSource = await db.sourceCitation.create({
    data: {
      url: "https://example.org/scholarship",
      publisher: "Example Foundation",
      title: "Example Scholarship",
      accessedAt: new Date("2026-11-17T00:00:00.000Z"),
      verifiedAt: new Date("2026-11-17T00:00:00.000Z"),
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
      lastVerifiedAt: new Date("2026-11-17T00:00:00.000Z"),
      primarySourceId: source.id,
    },
    select: { id: true },
  });
  universityId = university.id;

  const program = await db.program.create({
    data: {
      universityId,
      slug: "msc-computer-science",
      name: "Computer Science",
      degreeLevel: "MASTER",
      field: "Computer Science",
      language: "English",
      startNote: "Winter semester",
      verificationStatus: "VERIFIED",
      lastVerifiedAt: new Date("2026-11-17T00:00:00.000Z"),
      primarySourceId: source.id,
    },
    select: { id: true },
  });
  programId = program.id;
  await Promise.all([
    db.tuitionFact.create({
      data: {
        programId,
        amountMinor: 1_200_000,
        currency: "EUR",
        period: "per year",
        applicantGroup: "International applicants",
        verificationStatus: "VERIFIED",
        sourceId: source.id,
      },
    }),
    db.programIntake.create({
      data: {
        programId,
        term: "WINTER",
        verificationStatus: "VERIFIED",
        sourceId: source.id,
      },
    }),
    db.programCost.create({
      data: {
        programId,
        kind: "APPLICATION_FEE",
        amountMinor: 5_000,
        currency: "EUR",
        period: "per application",
        verificationStatus: "VERIFIED",
        sourceId: source.id,
      },
    }),
    db.deadlineFact.create({
      data: {
        programId,
        cycle: "Winter semester",
        deadlineMonthDay: "12-31",
        verificationStatus: "VERIFIED",
        sourceId: source.id,
      },
    }),
  ]);

  const scholarship = await db.scholarship.create({
    data: {
      slug: "example-scholarship",
      name: "Example Scholarship",
      providerName: "Example Foundation",
      providerUrl: "https://example.org/",
      hostCountryCode: "DE",
      fundingType: "PARTIAL",
      degreeLevels: ["MASTER"],
      nationalityScope: "UNKNOWN",
      eligibleNationalities: [],
      fieldScope: "UNKNOWN",
      fields: [],
      summary: "A verified scholarship.",
      verificationStatus: "VERIFIED",
      lastVerifiedAt: new Date("2026-11-17T00:00:00.000Z"),
      primarySourceId: scholarshipSource.id,
    },
    select: { id: true },
  });
  await db.programScholarship.create({
    data: {
      programId,
      scholarshipId: scholarship.id,
      verificationStatus: "VERIFIED",
      sourceId: scholarshipSource.id,
    },
  });

  await db.university.create({
    data: {
      slug: "second-university",
      name: "Second University",
      city: "Munich",
      countryCode: "DE",
      websiteUrl: "https://second.example.edu/",
      verificationStatus: "VERIFIED",
      primarySourceId: source.id,
      programs: {
        create: {
          slug: "bachelor-design",
          name: "Design",
          degreeLevel: "BACHELOR",
          field: "Arts & Humanities",
          verificationStatus: "VERIFIED",
          primarySourceId: source.id,
          tuitionFacts: {
            create: {
              amountMinor: 800_000,
              currency: "EUR",
              period: "per year",
              verificationStatus: "VERIFIED",
              sourceId: source.id,
            },
          },
        },
      },
    },
    select: { id: true },
  });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("dashboard university discovery queries", () => {
  it("searches and filters by country, degree, annual tuition, intake, and scholarship", async () => {
    const all = await listUniversityDiscovery(
      parseUniversityDiscoveryFilters({}),
      studentId,
    );
    expect(all.total).toBe(2);

    const filtered = await listUniversityDiscovery(
      parseUniversityDiscoveryFilters({
        q: "example",
        country: "DE",
        degree: "MASTER",
        maxTuition: "13000",
        currency: "EUR",
        intake: "WINTER",
        scholarship: "yes",
      }),
      studentId,
    );
    expect(filtered.items.map((item) => item.slug)).toEqual([
      "example-university",
    ]);

    const noScholarship = await listUniversityDiscovery(
      parseUniversityDiscoveryFilters({ scholarship: "no" }),
      studentId,
    );
    expect(noScholarship.items.map((item) => item.slug)).toEqual([
      "second-university",
    ]);

    const byTuition = await listUniversityDiscovery(
      parseUniversityDiscoveryFilters({ sort: "tuition" }),
      studentId,
    );
    expect(byTuition.items[0]?.slug).toBe("second-university");

    const byDeadline = await listUniversityDiscovery(
      parseUniversityDiscoveryFilters({ sort: "deadline" }),
      studentId,
    );
    expect(byDeadline.items[0]?.slug).toBe("example-university");
  });

  it("returns cited details and keeps favorites and tracker state user-scoped", async () => {
    expect(
      await setCatalogFavorite(studentId, "UNIVERSITY", universityId, true),
    ).toEqual({ ok: true });
    const application = await createApplication(studentId, {
      universityId,
      status: "INTERESTED",
      notes: "",
      deadline: null,
    });
    expect(application.ok).toBe(true);

    const detail = await getUniversityDiscoveryDetail(
      "example-university",
      studentId,
    );
    expect(detail?.primarySource.url).toBe("https://example.edu/program");
    expect(detail?.programs[0]?.tuition[0]?.amountMinor).toBe(1_200_000);
    expect(detail?.programs[0]?.costs[0]?.kind).toBe("APPLICATION_FEE");
    expect(detail?.programs[0]?.scholarships[0]?.slug).toBe(
      "example-scholarship",
    );
    expect(detail?.isFavorite).toBe(true);
    expect(detail?.isTracked).toBe(true);

    const otherDetail = await getUniversityDiscoveryDetail(
      "example-university",
      otherStudentId,
    );
    expect(otherDetail?.isFavorite).toBe(false);
    expect(otherDetail?.isTracked).toBe(false);
    expect(
      await getUniversityDiscoveryDetail("unknown-university", studentId),
    ).toBeNull();
  });

  it("adds a verified program deadline only to the owner's tracker", async () => {
    const application = await createApplication(studentId, {
      universityId,
      status: "INTERESTED",
      notes: "",
      deadline: null,
    });
    if (!application.ok) throw new Error("Tracker setup failed.");

    const deadline = new Date("2027-01-15T00:00:00.000Z");
    expect(
      await setApplicationDeadline(otherStudentId, universityId, deadline),
    ).toBe(false);
    expect(
      await setApplicationDeadline(studentId, universityId, deadline),
    ).toBe(true);
    const saved = await db.application.findUniqueOrThrow({
      where: { id: application.id },
      select: { deadline: true },
    });
    expect(saved.deadline?.toISOString().slice(0, 10)).toBe("2027-01-15");
  });
});
