import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import {
  parseScholarshipFilters,
  parseUniversityFilters,
} from "@/lib/catalog/filters";
import {
  listCatalogFavorites,
  setCatalogFavorite,
} from "@/lib/catalog/favorites";
import {
  getDataQualityReport,
  getProgramDetail,
  getProvenanceResponse,
  getReviewQueue,
  getScholarshipBySlug,
  getUniversityBySlug,
  listScholarships,
  listUniversities,
} from "@/lib/catalog/queries";
import {
  addDeadline,
  addRequirement,
  addTuition,
  createProgram,
  createScholarship,
  createUniversity,
  recordDecision,
  removeFact,
  runExpirySweep,
  updateRecord,
  type Reviewer,
} from "@/lib/catalog/review-service";
import { provenanceResponseSchema } from "@/lib/catalog/provenance";
import type {
  DeadlineInput,
  ProgramFieldsInput,
  ScholarshipFieldsInput,
  SourceInput,
  UniversityFieldsInput,
} from "@/lib/catalog/review-validation";

const reviewer: Reviewer = { id: "" };

function source(overrides: Partial<SourceInput> = {}): SourceInput {
  return {
    url: "https://www.example.edu/study/program",
    publisher: "Example University",
    title: "Program page — Example University",
    accessedAt: "2026-11-12",
    verifiedAt: "2026-11-12",
    notes: null,
    ...overrides,
  };
}

function universityFields(
  overrides: Partial<UniversityFieldsInput> = {},
): UniversityFieldsInput {
  return {
    name: "Example University",
    shortName: "Example",
    city: "Berlin",
    countryCode: "DE",
    websiteUrl: "https://www.example.edu/",
    slug: "example-university",
    ...overrides,
  };
}

function programFields(
  universityId: string,
  overrides: Partial<ProgramFieldsInput> = {},
): ProgramFieldsInput {
  return {
    universityId,
    name: "Computer Science",
    slug: "msc-computer-science",
    degreeLevel: "MASTER",
    field: "Computer Science",
    language: "English",
    durationMonths: 24,
    credits: 120,
    startNote: "Winter semester",
    ...overrides,
  };
}

function scholarshipFields(
  overrides: Partial<ScholarshipFieldsInput> = {},
): ScholarshipFieldsInput {
  return {
    name: "Example Global Scholarship",
    slug: "example-global-scholarship",
    providerName: "Example Foundation",
    providerUrl: "https://www.example.org/scholarships",
    hostCountryCode: "SE",
    fundingType: "FULLY_FUNDED",
    degreeLevels: ["MASTER"],
    nationalityScope: "LISTED",
    eligibleNationalities: ["KE", "UZ"],
    fieldScope: "ALL",
    fields: ["Computer Science"],
    summary:
      "A fully funded scholarship for master's study, verified against the provider page.",
    ...overrides,
  };
}

const deadlineFact: DeadlineInput = {
  cycle: "Autumn intake",
  applicantGroup: null,
  opensOn: null,
  deadlineOn: "2027-01-15",
  opensMonthDay: null,
  deadlineMonthDay: null,
  note: null,
};

beforeEach(async () => {
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "UniversityFavorite", "ScholarshipFavorite", "CatalogReview", "Requirement", "TuitionFact", "DeadlineFact", "Program", "Scholarship", "University", "SourceCitation", "AuditEvent", "RateLimitCounter", "ConsentRecord", "AuthToken", "Session", "StudentProfile", "User" RESTART IDENTITY CASCADE',
  );

  const user = await db.user.create({
    data: {
      email: "reviewer@example.com",
      name: "Rita Reviewer",
      role: "REVIEWER",
      emailVerifiedAt: new Date(),
    },
    select: { id: true },
  });
  reviewer.id = user.id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("reviewer imports", () => {
  it("stores a verified university with its source and an audit trail", async () => {
    const result = await createUniversity(
      universityFields(),
      source(),
      true,
      reviewer,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const university = await db.university.findUniqueOrThrow({
      where: { id: result.id },
      include: { primarySource: true },
    });

    expect(university.verificationStatus).toBe("VERIFIED");
    expect(university.lastVerifiedAt?.toISOString().slice(0, 10)).toBe(
      "2026-11-12",
    );
    expect(university.nextReviewAt?.toISOString().slice(0, 10)).toBe(
      "2027-05-11",
    );
    expect(university.primarySource.url).toBe(source().url);
    expect(
      university.primarySource.verifiedAt?.toISOString().slice(0, 10),
    ).toBe("2026-11-12");

    const review = await db.catalogReview.findFirst({
      where: { entityType: "UNIVERSITY", entityId: result.id },
    });
    expect(review?.decision).toBe("IMPORT");
    expect(review?.fromStatus).toBeNull();
    expect(review?.toStatus).toBe("VERIFIED");
    expect(review?.reviewerId).toBe(reviewer.id);

    const audit = await db.auditEvent.findFirst({
      where: { actorId: reviewer.id, action: "catalog.import" },
    });
    expect(audit).not.toBeNull();
  });

  it("keeps an unpublished import out of the public catalog", async () => {
    const result = await createUniversity(
      universityFields(),
      source({ verifiedAt: null }),
      false,
      reviewer,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const list = await listUniversities(parseUniversityFilters({}));
    expect(list.items).toHaveLength(0);
    expect(await getUniversityBySlug("example-university")).toBeNull();

    const review = await db.catalogReview.findFirst({
      where: { entityId: result.id },
    });
    expect(review?.toStatus).toBe("UNVERIFIED");
  });

  it("creates program facts that inherit the primary source", async () => {
    const university = await createUniversity(
      universityFields(),
      source(),
      true,
      reviewer,
    );
    if (!university.ok) throw new Error(university.message);

    const program = await createProgram(
      programFields(university.id),
      source(),
      {
        requirements: [
          {
            kind: "ACADEMIC",
            summary: "A recognized bachelor's degree in computer science.",
          },
        ],
        tuition: [
          {
            amount: "6000",
            currency: "EUR",
            period: "per semester",
            applicantGroup: "International students",
            note: null,
          },
        ],
        deadlines: [deadlineFact],
      },
      true,
      reviewer,
    );
    expect(program.ok).toBe(true);
    if (!program.ok) return;

    const requirements = await db.requirement.findMany({
      where: { programId: program.id },
      include: { source: true },
    });
    expect(requirements).toHaveLength(1);
    expect(requirements[0]?.verificationStatus).toBe("VERIFIED");
    expect(requirements[0]?.source.verifiedAt).not.toBeNull();

    const tuition = await db.tuitionFact.findFirstOrThrow({
      where: { programId: program.id },
    });
    expect(tuition.amountMinor).toBe(600_000);
    expect(tuition.currency).toBe("EUR");

    const detail = await getProgramDetail(
      "example-university",
      "msc-computer-science",
    );
    expect(detail).not.toBeNull();
    expect(detail?.program.provenance.status).toBe("VERIFIED");
    expect(detail?.program.provenance.source?.url).toBe(source().url);
    expect(detail?.requirements).toHaveLength(1);
    expect(detail?.tuition[0]?.amountMinor).toBe(600_000);
    expect(detail?.deadlines[0]?.deadlineOn).toBe("2027-01-15");
  });

  it("serialises a provenance response that satisfies the public contract", async () => {
    const university = await createUniversity(
      universityFields(),
      source(),
      true,
      reviewer,
    );
    if (!university.ok) throw new Error(university.message);

    const program = await createProgram(
      programFields(university.id),
      source(),
      { requirements: [], tuition: [], deadlines: [] },
      true,
      reviewer,
    );
    if (!program.ok) throw new Error(program.message);

    const response = await getProvenanceResponse("PROGRAM", program.id);
    expect(response).not.toBeNull();

    const parsed = provenanceResponseSchema.safeParse(response);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.status).toBe("VERIFIED");
      expect(parsed.data.sources.length).toBeGreaterThan(0);
    }
  });

  it("creates a scholarship with eligibility facts", async () => {
    const scholarship = await createScholarship(
      scholarshipFields(),
      source({
        url: "https://www.example.org/scholarships",
        publisher: "Example Foundation",
      }),
      {
        requirements: [],
        tuition: [],
        deadlines: [
          {
            cycle: "Annual round",
            applicantGroup: null,
            opensOn: null,
            deadlineOn: null,
            opensMonthDay: "10-01",
            deadlineMonthDay: "01-15",
            note: null,
          },
        ],
      },
      true,
      reviewer,
    );
    expect(scholarship.ok).toBe(true);
    if (!scholarship.ok) return;

    const list = await listScholarships(parseScholarshipFilters({}));
    expect(list.items.map((item) => item.slug)).toContain(
      "example-global-scholarship",
    );

    const byNationality = await listScholarships(
      parseScholarshipFilters({ nationality: "KE" }),
    );
    expect(byNationality.items).toHaveLength(1);

    const excluded = await listScholarships(
      parseScholarshipFilters({ nationality: "BR" }),
    );
    expect(excluded.items).toHaveLength(0);
  });
});

describe("reviewer decisions", () => {
  it("refuses to approve a record whose source has no verification date", async () => {
    const result = await createUniversity(
      universityFields(),
      source({ verifiedAt: null }),
      false,
      reviewer,
    );
    if (!result.ok) throw new Error(result.message);

    const decision = await recordDecision({
      entityType: "UNIVERSITY",
      id: result.id,
      decision: "APPROVE",
      note: null,
      reviewer,
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.message).toMatch(/date you checked/i);
    }

    const university = await db.university.findUniqueOrThrow({
      where: { id: result.id },
    });
    expect(university.verificationStatus).toBe("UNVERIFIED");
  });

  it("approves after the source gains a verification date and schedules re-review", async () => {
    const result = await createUniversity(
      universityFields(),
      source({ verifiedAt: null }),
      false,
      reviewer,
    );
    if (!result.ok) throw new Error(result.message);

    const updated = await updateRecord({
      entityType: "UNIVERSITY",
      id: result.id,
      source: source(),
      publish: false,
      reviewer,
      university: universityFields(),
    });
    expect(updated.ok).toBe(true);

    const afterEdit = await db.university.findUniqueOrThrow({
      where: { id: result.id },
    });
    expect(afterEdit.verificationStatus).toBe("NEEDS_REVIEW");

    const decision = await recordDecision({
      entityType: "UNIVERSITY",
      id: result.id,
      decision: "APPROVE",
      note: "Checked against the official page.",
      reviewer,
    });
    expect(decision.ok).toBe(true);

    const approved = await db.university.findUniqueOrThrow({
      where: { id: result.id },
    });
    expect(approved.verificationStatus).toBe("VERIFIED");
    expect(approved.lastVerifiedAt?.toISOString().slice(0, 10)).toBe(
      "2026-11-12",
    );
    expect(approved.nextReviewAt?.toISOString().slice(0, 10)).toBe(
      "2027-05-11",
    );

    const review = await db.catalogReview.findFirst({
      where: { entityId: result.id, decision: "APPROVE" },
    });
    expect(review?.note).toBe("Checked against the official page.");
  });

  it("hides an expired record from the public catalog but keeps the row", async () => {
    const result = await createUniversity(
      universityFields(),
      source(),
      true,
      reviewer,
    );
    if (!result.ok) throw new Error(result.message);

    const decision = await recordDecision({
      entityType: "UNIVERSITY",
      id: result.id,
      decision: "EXPIRE",
      note: "Provider replaced the page.",
      reviewer,
    });
    expect(decision.ok).toBe(true);

    expect(await getUniversityBySlug("example-university")).toBeNull();
    const row = await db.university.findUnique({ where: { id: result.id } });
    expect(row?.verificationStatus).toBe("EXPIRED");
  });

  it("archives university and scholarship records without erasing their history", async () => {
    const university = await createUniversity(
      universityFields(),
      source(),
      true,
      reviewer,
    );
    const scholarship = await createScholarship(
      scholarshipFields(),
      source({
        url: "https://www.example.org/scholarships",
        publisher: "Example Foundation",
      }),
      { requirements: [], tuition: [], deadlines: [] },
      true,
      reviewer,
    );
    if (!university.ok) throw new Error(university.message);
    if (!scholarship.ok) throw new Error(scholarship.message);

    for (const [entityType, id] of [
      ["UNIVERSITY", university.id],
      ["SCHOLARSHIP", scholarship.id],
    ] as const) {
      const archived = await recordDecision({
        entityType,
        id,
        decision: "ARCHIVE",
        note: "Record withdrawn from the catalog.",
        reviewer,
      });
      expect(archived.ok).toBe(true);
    }

    expect(await getUniversityBySlug("example-university")).toBeNull();
    expect((await listScholarships(parseScholarshipFilters({}))).total).toBe(0);
    expect(
      await db.catalogReview.count({
        where: { decision: "ARCHIVE", reviewerId: reviewer.id },
      }),
    ).toBe(2);
    expect(
      await db.auditEvent.count({
        where: {
          action: "catalog.archive",
          actorId: reviewer.id,
        },
      }),
    ).toBe(2);

    const restored = await recordDecision({
      entityType: "UNIVERSITY",
      id: university.id,
      decision: "RESTORE",
      note: "Returned for re-review.",
      reviewer,
    });
    expect(restored.ok).toBe(true);
    expect(await getUniversityBySlug("example-university")).not.toBeNull();
  });

  it("returns an edited record to review, then re-verifies it", async () => {
    const result = await createUniversity(
      universityFields(),
      source(),
      true,
      reviewer,
    );
    if (!result.ok) throw new Error(result.message);

    const edit = await updateRecord({
      entityType: "UNIVERSITY",
      id: result.id,
      source: source(),
      publish: false,
      reviewer,
      university: universityFields({ city: "Munich" }),
    });
    expect(edit.ok).toBe(true);

    const pending = await db.university.findUniqueOrThrow({
      where: { id: result.id },
    });
    expect(pending.verificationStatus).toBe("NEEDS_REVIEW");
    expect(pending.lastVerifiedAt).toBeNull();
    expect(await getUniversityBySlug("example-university")).not.toBeNull();

    const reverify = await updateRecord({
      entityType: "UNIVERSITY",
      id: result.id,
      source: source({ verifiedAt: "2026-12-01" }),
      publish: true,
      reviewer,
      university: universityFields({ city: "Munich" }),
    });
    expect(reverify.ok).toBe(true);

    const verified = await db.university.findUniqueOrThrow({
      where: { id: result.id },
    });
    expect(verified.verificationStatus).toBe("VERIFIED");
    expect(verified.lastVerifiedAt?.toISOString().slice(0, 10)).toBe(
      "2026-12-01",
    );

    const edits = await db.catalogReview.findMany({
      where: { entityId: result.id, decision: "EDIT" },
    });
    expect(edits).toHaveLength(2);
  });

  it("updates scholarship fields and replaces its verified source", async () => {
    const result = await createScholarship(
      scholarshipFields(),
      source({
        url: "https://www.example.org/scholarships",
        publisher: "Example Foundation",
      }),
      { requirements: [], tuition: [], deadlines: [] },
      true,
      reviewer,
    );
    if (!result.ok) throw new Error(result.message);

    const edit = await updateRecord({
      entityType: "SCHOLARSHIP",
      id: result.id,
      source: source({
        url: "https://www.example.org/scholarships/2027",
        publisher: "Example Foundation",
        title: "2027 scholarship rules",
        verifiedAt: "2026-12-01",
      }),
      publish: true,
      reviewer,
      scholarship: scholarshipFields({
        providerName: "Example Foundation for Education",
        summary:
          "Updated award details checked against the foundation's current official scholarship rules.",
      }),
    });
    expect(edit.ok).toBe(true);

    const scholarship = await db.scholarship.findUniqueOrThrow({
      where: { id: result.id },
      include: { primarySource: true },
    });
    expect(scholarship.providerName).toBe("Example Foundation for Education");
    expect(scholarship.verificationStatus).toBe("VERIFIED");
    expect(scholarship.lastVerifiedAt?.toISOString().slice(0, 10)).toBe(
      "2026-12-01",
    );
    expect(scholarship.primarySource.url).toBe(
      "https://www.example.org/scholarships/2027",
    );

    const detail = await getScholarshipBySlug("example-global-scholarship");
    expect(detail?.scholarship.providerName).toBe(
      "Example Foundation for Education",
    );
    expect(detail?.scholarship.provenance.source?.verifiedAt).toBe(
      "2026-12-01",
    );
  });

  it("refuses to publish without a source verification date", async () => {
    const result = await createUniversity(
      universityFields(),
      source(),
      true,
      reviewer,
    );
    if (!result.ok) throw new Error(result.message);

    const outcome = await updateRecord({
      entityType: "UNIVERSITY",
      id: result.id,
      source: source({ verifiedAt: null }),
      publish: true,
      reviewer,
      university: universityFields(),
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.fieldErrors?.verifiedAt).toBeTruthy();
    }
  });
});

describe("facts", () => {
  async function seedProgram() {
    const university = await createUniversity(
      universityFields(),
      source(),
      true,
      reviewer,
    );
    if (!university.ok) throw new Error(university.message);
    const program = await createProgram(
      programFields(university.id),
      source(),
      { requirements: [], tuition: [], deadlines: [] },
      true,
      reviewer,
    );
    if (!program.ok) throw new Error(program.message);
    return program.id;
  }

  it("adds and removes a requirement, writing an audit event each time", async () => {
    const programId = await seedProgram();

    const added = await addRequirement(
      "PROGRAM",
      programId,
      {
        kind: "ENGLISH_LANGUAGE",
        summary: "IELTS 6.5 overall with no band below 6.0.",
      },
      reviewer,
    );
    expect(added.ok).toBe(true);
    if (!added.ok) return;

    const stored = await db.requirement.findUniqueOrThrow({
      where: { id: added.id },
      include: { source: true },
    });
    expect(stored.verificationStatus).toBe("VERIFIED");
    expect(stored.source.url).toBe(source().url);

    const removed = await removeFact("requirement", added.id, reviewer);
    expect(removed.ok).toBe(true);
    expect(await db.requirement.count({ where: { id: added.id } })).toBe(0);

    const audits = await db.auditEvent.findMany({
      where: { actorId: reviewer.id },
      select: { action: true },
    });
    expect(audits.map((event) => event.action)).toEqual(
      expect.arrayContaining(["catalog.fact_added", "catalog.fact_removed"]),
    );
  });

  it("adds a tuition fact in minor units", async () => {
    const programId = await seedProgram();

    const added = await addTuition(
      programId,
      {
        amount: "2771.50",
        currency: "EUR",
        period: "per year",
        applicantGroup: "Non-EU applicants",
        note: null,
      },
      reviewer,
    );
    expect(added.ok).toBe(true);
    if (!added.ok) return;

    const stored = await db.tuitionFact.findUniqueOrThrow({
      where: { id: added.id },
    });
    expect(stored.amountMinor).toBe(277_150);
    expect(stored.currency).toBe("EUR");
  });

  it("adds a recurring deadline fact", async () => {
    const programId = await seedProgram();

    const added = await addDeadline(
      "PROGRAM",
      programId,
      {
        cycle: "Annual intake",
        applicantGroup: null,
        opensOn: null,
        deadlineOn: null,
        opensMonthDay: "10-01",
        deadlineMonthDay: "01-15",
        note: null,
      },
      reviewer,
    );
    expect(added.ok).toBe(true);
    if (!added.ok) return;

    const stored = await db.deadlineFact.findUniqueOrThrow({
      where: { id: added.id },
    });
    expect(stored.deadlineMonthDay).toBe("01-15");
    expect(stored.deadlineOn).toBeNull();
  });
});

describe("public read safety", () => {
  it("refuses to render a verified fact whose source lost its verification date", async () => {
    const university = await createUniversity(
      universityFields(),
      source(),
      true,
      reviewer,
    );
    if (!university.ok) throw new Error(university.message);

    const program = await createProgram(
      programFields(university.id),
      source(),
      {
        requirements: [
          {
            kind: "ACADEMIC",
            summary: "A recognized bachelor's degree in computer science.",
          },
        ],
        tuition: [],
        deadlines: [],
      },
      true,
      reviewer,
    );
    if (!program.ok) throw new Error(program.message);

    expect(
      await getProgramDetail("example-university", "msc-computer-science"),
    ).not.toBeNull();

    await db.sourceCitation.updateMany({
      where: { url: source().url },
      data: { verifiedAt: null },
    });

    expect(
      await getProgramDetail("example-university", "msc-computer-science"),
    ).toBeNull();
    expect(await getProvenanceResponse("PROGRAM", program.id)).toBeNull();
  });

  it("filters universities by country, query, and program attributes", async () => {
    const german = await createUniversity(
      universityFields(),
      source(),
      true,
      reviewer,
    );
    if (!german.ok) throw new Error(german.message);
    await createProgram(
      programFields(german.id),
      source(),
      { requirements: [], tuition: [], deadlines: [] },
      true,
      reviewer,
    );

    const dutch = await createUniversity(
      universityFields({
        name: "Amsterdam Example University",
        shortName: "AEU",
        city: "Amsterdam",
        countryCode: "NL",
        websiteUrl: "https://www.example.nl/",
        slug: "amsterdam-example-university",
      }),
      source({
        url: "https://www.example.nl/study/program",
        publisher: "Amsterdam Example University",
      }),
      true,
      reviewer,
    );
    if (!dutch.ok) throw new Error(dutch.message);
    await createProgram(
      programFields(dutch.id, {
        name: "Data Science",
        slug: "msc-data-science",
        field: "Technology & Data",
        degreeLevel: "PHD",
      }),
      source({
        url: "https://www.example.nl/study/program",
        publisher: "Amsterdam Example University",
      }),
      { requirements: [], tuition: [], deadlines: [] },
      true,
      reviewer,
    );

    expect(
      (await listUniversities(parseUniversityFilters({ country: "DE" }))).items,
    ).toHaveLength(1);
    expect(
      (await listUniversities(parseUniversityFilters({ q: "amsterdam" })))
        .items,
    ).toHaveLength(1);
    expect(
      (
        await listUniversities(parseUniversityFilters({ degree: "PHD" }))
      ).items.map((item) => item.countryCode),
    ).toEqual(["NL"]);
    expect(
      (
        await listUniversities(
          parseUniversityFilters({ field: "Technology & Data" }),
        )
      ).items,
    ).toHaveLength(1);
  });
});

describe("expiry sweep", () => {
  it("moves stale verified records to review without deleting them", async () => {
    const result = await createUniversity(
      universityFields(),
      source(),
      true,
      reviewer,
    );
    if (!result.ok) throw new Error(result.message);

    await db.university.update({
      where: { id: result.id },
      data: { nextReviewAt: new Date("2020-01-01T00:00:00.000Z") },
    });

    const sweep = await runExpirySweep(reviewer.id);
    expect(sweep.flagged).toBe(1);
    expect(sweep.byType.UNIVERSITY).toBe(1);

    const university = await db.university.findUniqueOrThrow({
      where: { id: result.id },
    });
    expect(university.verificationStatus).toBe("NEEDS_REVIEW");

    const flag = await db.catalogReview.findFirst({
      where: { entityId: result.id, decision: "FLAG_STALE" },
    });
    expect(flag?.toStatus).toBe("NEEDS_REVIEW");
    expect(flag?.note).toContain("2020-01-01");

    const audit = await db.auditEvent.findFirst({
      where: { entityId: result.id, action: "catalog.flag_stale" },
    });
    expect(audit).not.toBeNull();

    // Stale records stay visible, flagged rather than hidden.
    expect(await getUniversityBySlug("example-university")).not.toBeNull();
  });
});

describe("data quality report", () => {
  it("counts records by status and coverage by country", async () => {
    await createUniversity(universityFields(), source(), true, reviewer);
    await createUniversity(
      universityFields({
        name: "Review University",
        slug: "review-university",
        websiteUrl: "https://www.review.edu/",
        countryCode: "NL",
      }),
      source({
        url: "https://www.review.edu/program",
        publisher: "Review University",
      }),
      false,
      reviewer,
    );
    await createUniversity(
      universityFields({
        name: "Pending University",
        slug: "pending-university",
        websiteUrl: "https://www.pending.edu/",
        countryCode: "SE",
      }),
      source({
        url: "https://www.pending.edu/program",
        publisher: "Pending University",
        verifiedAt: null,
      }),
      false,
      reviewer,
    );

    const report = await getDataQualityReport();
    expect(report.statusCounts.UNIVERSITY.VERIFIED).toBe(1);
    expect(report.statusCounts.UNIVERSITY.NEEDS_REVIEW).toBe(1);
    expect(report.statusCounts.UNIVERSITY.UNVERIFIED).toBe(1);
    expect(report.verifiedRecords).toBe(1);
    expect(report.citationsWithoutVerification).toBe(1);
    expect(report.coverage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ countryCode: "DE", universities: 1 }),
        expect.objectContaining({ countryCode: "NL", universities: 1 }),
      ]),
    );
    // Unverified records are not part of public coverage.
    expect(report.coverage.map((row) => row.countryCode)).not.toContain("SE");

    const queue = await getReviewQueue();
    expect(queue.counts.unverified).toBe(1);
    expect(queue.items.map((item) => item.slug)).toContain(
      "pending-university",
    );
  });
});

describe("student favorites", () => {
  it("saves, lists, and removes universities and scholarships per user", async () => {
    const university = await createUniversity(
      universityFields(),
      source(),
      true,
      reviewer,
    );
    const scholarship = await createScholarship(
      scholarshipFields(),
      source({
        url: "https://www.example.org/scholarships",
        publisher: "Example Foundation",
      }),
      { requirements: [], tuition: [], deadlines: [] },
      true,
      reviewer,
    );
    if (!university.ok) throw new Error(university.message);
    if (!scholarship.ok) throw new Error(scholarship.message);

    expect(
      await setCatalogFavorite(reviewer.id, "UNIVERSITY", university.id, true),
    ).toEqual({ ok: true });
    expect(
      await setCatalogFavorite(
        reviewer.id,
        "SCHOLARSHIP",
        scholarship.id,
        true,
      ),
    ).toEqual({ ok: true });

    expect(
      (await listUniversities(parseUniversityFilters({}), reviewer.id)).items[0]
        ?.isFavorite,
    ).toBe(true);
    expect(
      (await listScholarships(parseScholarshipFilters({}), reviewer.id))
        .items[0]?.isFavorite,
    ).toBe(true);
    expect(
      (await getUniversityBySlug("example-university", reviewer.id))?.university
        .isFavorite,
    ).toBe(true);
    expect(
      (await getScholarshipBySlug("example-global-scholarship", reviewer.id))
        ?.isFavorite,
    ).toBe(true);
    expect(await listCatalogFavorites(reviewer.id)).toHaveLength(2);

    await setCatalogFavorite(reviewer.id, "UNIVERSITY", university.id, false);
    await setCatalogFavorite(reviewer.id, "SCHOLARSHIP", scholarship.id, false);
    expect(await listCatalogFavorites(reviewer.id)).toHaveLength(0);
    expect(
      (await listUniversities(parseUniversityFilters({}), reviewer.id)).items[0]
        ?.isFavorite,
    ).toBe(false);
  });

  it("does not allow saving a record hidden from public discovery", async () => {
    const university = await createUniversity(
      universityFields(),
      source({ verifiedAt: null }),
      false,
      reviewer,
    );
    if (!university.ok) throw new Error(university.message);

    expect(
      await setCatalogFavorite(reviewer.id, "UNIVERSITY", university.id, true),
    ).toEqual({
      ok: false,
      message: "That university is no longer available.",
    });
    expect(await listCatalogFavorites(reviewer.id)).toHaveLength(0);
  });
});
