import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  applyScholarshipStatusAction,
  createAdminScholarship,
  exportScholarshipsCsv,
  getAdminScholarship,
  importScholarshipsCsv,
  setScholarshipFeatured,
  updateAdminScholarship,
  verifyScholarshipSource,
} from "@/lib/admin/scholarship-management";
import { listAdminScholarships } from "@/lib/admin/scholarships";
import { parseScholarshipFilters } from "@/lib/catalog/filters";
import { listScholarships } from "@/lib/catalog/queries";
import { db } from "@/lib/db";

const actor = { id: "" };

function fields(overrides: Record<string, unknown> = {}) {
  return {
    name: "Example Scholarship",
    slug: "example-scholarship",
    providerName: "Example Foundation",
    providerUrl: "https://foundation.example/scholarship",
    hostCountryCode: "DE",
    fundingType: "FULLY_FUNDED",
    degreeLevels: ["MASTER"],
    nationalityScope: "ALL",
    eligibleNationalities: [],
    fieldScope: "ALL",
    fields: ["Computer Science"],
    summary: "A sourced scholarship record used for administration tests.",
    ...overrides,
  };
}

function source(overrides: Record<string, unknown> = {}) {
  return {
    url: "https://foundation.example/official-source",
    publisher: "Example Foundation",
    title: "Official scholarship announcement",
    accessedAt: "2026-11-20",
    verifiedAt: "2026-11-20",
    notes: "",
    ...overrides,
  };
}

beforeEach(async () => {
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "UniversityFavorite", "ScholarshipFavorite", "CatalogFieldFact", "CatalogReview", "Requirement", "TuitionFact", "DeadlineFact", "ProgramScholarship", "Program", "Scholarship", "University", "SourceCitation", "AuditEvent", "AdminPermissionGrant", "RateLimitCounter", "ConsentRecord", "AuthToken", "Session", "StudentProfile", "User" RESTART IDENTITY CASCADE',
  );
  const user = await db.user.create({
    data: {
      email: "manager@example.com",
      name: "Scholarship Manager",
      role: "SCHOLARSHIP_MANAGER",
      emailVerifiedAt: new Date(),
    },
    select: { id: true },
  });
  actor.id = user.id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("administrative scholarship management", () => {
  it("creates a sourced record, rejects duplicates, and audits the outcomes", async () => {
    const created = await createAdminScholarship({
      fields: fields(),
      source: source(),
      publish: true,
      actorId: actor.id,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const duplicate = await createAdminScholarship({
      fields: fields({ slug: "example-scholarship-copy" }),
      source: source({ url: "https://foundation.example/duplicate-source" }),
      publish: false,
      actorId: actor.id,
    });
    expect(duplicate).toMatchObject({ ok: false, reason: "duplicate" });

    const record = await db.scholarship.findUniqueOrThrow({
      where: { id: created.id },
      include: { primarySource: true },
    });
    expect(record.verificationStatus).toBe("VERIFIED");
    expect(record.featured).toBe(false);
    expect(record.lastVerifiedAt?.toISOString().slice(0, 10)).toBe(
      "2026-11-20",
    );
    expect(record.primarySource.verifiedAt?.toISOString().slice(0, 10)).toBe(
      "2026-11-20",
    );

    const audit = await db.auditEvent.findMany({
      where: { entityType: "SCHOLARSHIP", entityId: created.id },
      select: { action: true },
    });
    expect(audit.map((event) => event.action)).toContain(
      "admin.scholarship_created",
    );
  });

  it("blocks publishing without a verified source", async () => {
    const created = await createAdminScholarship({
      fields: fields(),
      source: source({ verifiedAt: "" }),
      publish: true,
      actorId: actor.id,
    });
    expect(created).toMatchObject({
      ok: false,
      reason: "source_unverified",
    });
    expect(await db.scholarship.count()).toBe(0);
  });

  it("enforces publish, unpublish, archive, restore, and feature rules", async () => {
    const created = await createAdminScholarship({
      fields: fields(),
      source: source(),
      publish: false,
      actorId: actor.id,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(
      await setScholarshipFeatured({
        id: created.id,
        featured: true,
        actorId: actor.id,
      }),
    ).toMatchObject({ ok: false, reason: "not_published" });

    expect(
      await applyScholarshipStatusAction({
        id: created.id,
        action: "PUBLISH",
        actorId: actor.id,
      }),
    ).toMatchObject({ ok: true });
    expect(
      await setScholarshipFeatured({
        id: created.id,
        featured: true,
        actorId: actor.id,
      }),
    ).toMatchObject({ ok: true });

    expect(
      await applyScholarshipStatusAction({
        id: created.id,
        action: "UNPUBLISH",
        actorId: actor.id,
      }),
    ).toMatchObject({ ok: true });
    let record = await db.scholarship.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(record.verificationStatus).toBe("UNVERIFIED");
    expect(record.featured).toBe(false);

    expect(
      await applyScholarshipStatusAction({
        id: created.id,
        action: "ARCHIVE",
        actorId: actor.id,
      }),
    ).toMatchObject({ ok: true });
    expect(
      await applyScholarshipStatusAction({
        id: created.id,
        action: "PUBLISH",
        actorId: actor.id,
      }),
    ).toMatchObject({ ok: false, reason: "invalid_state" });
    expect(
      await applyScholarshipStatusAction({
        id: created.id,
        action: "RESTORE",
        actorId: actor.id,
      }),
    ).toMatchObject({ ok: true });
    record = await db.scholarship.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(record.verificationStatus).toBe("UNVERIFIED");

    const reviewDecisions = await db.catalogReview.findMany({
      where: { entityType: "SCHOLARSHIP", entityId: created.id },
      select: { decision: true },
      orderBy: { createdAt: "asc" },
    });
    expect(reviewDecisions.map((review) => review.decision)).toEqual([
      "IMPORT",
      "APPROVE",
      "REQUEST_CHANGES",
      "ARCHIVE",
      "RESTORE",
    ]);
  });

  it("records source verification on published records", async () => {
    const created = await createAdminScholarship({
      fields: fields(),
      source: source(),
      publish: true,
      actorId: actor.id,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const verified = await verifyScholarshipSource({
      id: created.id,
      verifiedAt: "2026-12-01",
      actorId: actor.id,
    });
    expect(verified.ok).toBe(true);

    const record = await db.scholarship.findUniqueOrThrow({
      where: { id: created.id },
      include: { primarySource: true },
    });
    expect(record.lastVerifiedAt?.toISOString().slice(0, 10)).toBe(
      "2026-12-01",
    );
    expect(record.nextReviewAt?.toISOString().slice(0, 10)).toBe("2027-05-30");
    expect(record.primarySource.verifiedAt?.toISOString().slice(0, 10)).toBe(
      "2026-12-01",
    );
  });

  it("surfaces detail warnings, featured filters, and public ordering", async () => {
    const zulu = await createAdminScholarship({
      fields: fields({
        name: "Zulu Future Fund",
        slug: "zulu-future-fund",
        providerName: "Zulu Foundation",
      }),
      source: source({ url: "https://foundation.example/zulu-source" }),
      publish: true,
      actorId: actor.id,
    });
    expect(zulu.ok).toBe(true);
    if (!zulu.ok) return;

    const alpha = await createAdminScholarship({
      fields: fields({
        name: "Alpha Future Fund",
        slug: "alpha-future-fund",
        providerName: "Alpha Foundation",
        hostCountryCode: null,
        degreeLevels: ["BACHELOR"],
        fields: [],
        summary: "A scholarship record with sparse eligibility metadata.",
      }),
      source: source({ url: "https://foundation.example/alpha-source" }),
      publish: true,
      actorId: actor.id,
    });
    expect(alpha.ok).toBe(true);
    if (!alpha.ok) return;

    await setScholarshipFeatured({
      id: zulu.id,
      featured: true,
      actorId: actor.id,
    });

    const detail = await getAdminScholarship(alpha.id);
    expect(detail?.warnings).toContain("The host country is missing.");
    expect(detail?.warnings).toContain("No eligible fields are documented.");
    expect(detail?.warnings).toContain("No requirements are recorded.");
    expect(detail?.warnings).toContain("No deadline is recorded.");

    const featured = await listAdminScholarships({
      query: "",
      status: null,
      featured: true,
      page: 1,
    });
    expect(featured.items.map((item) => item.id)).toEqual([zulu.id]);

    const publicList = await listScholarships(parseScholarshipFilters({}));
    expect(publicList.items[0]?.id).toBe(zulu.id);
    expect(publicList.items[0]?.featured).toBe(true);
  });

  it("exports a neutralised CSV and imports valid rows without partial duplicates", async () => {
    const created = await createAdminScholarship({
      fields: fields({
        summary: '=HYPERLINK("https://evil.example") unsafe formula',
      }),
      source: source(),
      publish: true,
      actorId: actor.id,
    });
    expect(created.ok).toBe(true);

    const csv = await exportScholarshipsCsv();
    expect(csv).toContain("\"'=HYPERLINK(");

    const imported = await importScholarshipsCsv({
      csv: [
        "name,slug,providerName,providerUrl,hostCountryCode,fundingType,degreeLevels,nationalityScope,eligibleNationalities,fieldScope,fields,summary,sourceUrl,sourcePublisher,sourceTitle,sourceAccessedAt,sourceVerifiedAt,publish",
        "CSV Fund,csv-fund,CSV Foundation,https://foundation.example/csv,FR,PARTIAL,MASTER|PHD,ALL,,ALL,Engineering,A sourced scholarship summary for csv import.,https://foundation.example/csv-source,CSV Publisher,CSV source page,2026-11-20,2026-11-20,false",
      ].join("\n"),
      actorId: actor.id,
    });
    expect(imported).toEqual({ created: 1, errors: [] });

    const duplicateImport = await importScholarshipsCsv({
      csv: [
        "name,providerName,providerUrl,fundingType,degreeLevels,nationalityScope,fieldScope,summary,sourceUrl,sourcePublisher,sourceTitle,sourceAccessedAt",
        "CSV Fund,CSV Foundation,https://foundation.example/other,PARTIAL,MASTER,ALL,ALL,A sourced scholarship summary for csv import.,https://foundation.example/other-source,CSV Publisher,CSV source page,2026-11-20",
      ].join("\n"),
      actorId: actor.id,
    });
    expect(duplicateImport.created).toBe(0);
    expect(duplicateImport.errors[0]).toContain("duplicate scholarship");
  });

  it("unpublishes and unfeatures when a full editor save drops the publish flag", async () => {
    const created = await createAdminScholarship({
      fields: fields(),
      source: source(),
      publish: true,
      actorId: actor.id,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(
      await setScholarshipFeatured({
        id: created.id,
        featured: true,
        actorId: actor.id,
      }),
    ).toMatchObject({ ok: true });

    const updated = await updateAdminScholarship({
      id: created.id,
      fields: fields({
        summary: "Updated summary for this scholarship record.",
      }),
      source: source(),
      publish: false,
      actorId: actor.id,
    });
    expect(updated.ok).toBe(true);

    const record = await db.scholarship.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(record.verificationStatus).toBe("UNVERIFIED");
    expect(record.featured).toBe(false);
    expect(record.summary).toBe("Updated summary for this scholarship record.");
  });
});
