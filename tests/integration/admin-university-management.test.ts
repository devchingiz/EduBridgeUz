import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { listAdminUniversities } from "@/lib/admin/universities";
import {
  applyUniversityStatusAction,
  createAdminUniversity,
  exportUniversitiesCsv,
  getAdminUniversity,
  importUniversitiesCsv,
  setUniversityFeatured,
  updateAdminUniversity,
  verifyUniversitySource,
} from "@/lib/admin/university-management";
import { parseUniversityFilters } from "@/lib/catalog/filters";
import { listUniversities } from "@/lib/catalog/queries";
import { db } from "@/lib/db";

const actor = { id: "" };

function fields(overrides: Record<string, unknown> = {}) {
  return {
    name: "Example University",
    slug: "example-university",
    shortName: "Example",
    city: "Berlin",
    countryCode: "DE",
    websiteUrl: "https://www.example.edu/",
    continent: "Europe",
    institutionType: "Public",
    logoUrl: "",
    description:
      "A source-linked university profile used for administration tests.",
    rankingOrganization: "QS",
    rankingEdition: "2027",
    rankingPosition: 42,
    rankingDisplay: "42",
    rankingTied: false,
    rankingIsRange: false,
    qsNid: null,
    ...overrides,
  };
}

function source(overrides: Record<string, unknown> = {}) {
  return {
    url: "https://www.example.edu/official-source",
    publisher: "Example University",
    title: "Official university profile",
    accessedAt: "2026-11-20",
    verifiedAt: "2026-11-20",
    notes: "",
    ...overrides,
  };
}

beforeEach(async () => {
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "UniversityFavorite", "ScholarshipFavorite", "CatalogFieldFact", "CatalogReview", "Requirement", "TuitionFact", "DeadlineFact", "Program", "Scholarship", "University", "SourceCitation", "AuditEvent", "AdminPermissionGrant", "RateLimitCounter", "ConsentRecord", "AuthToken", "Session", "StudentProfile", "User" RESTART IDENTITY CASCADE',
  );
  const user = await db.user.create({
    data: {
      email: "manager@example.com",
      name: "University Manager",
      role: "UNIVERSITY_MANAGER",
      emailVerifiedAt: new Date(),
    },
    select: { id: true },
  });
  actor.id = user.id;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("administrative university management", () => {
  it("creates a sourced record, rejects duplicates, and audits both outcomes", async () => {
    const created = await createAdminUniversity({
      fields: fields(),
      source: source(),
      publish: true,
      actorId: actor.id,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const duplicate = await createAdminUniversity({
      fields: fields({ slug: "example-university-copy" }),
      source: source({ url: "https://www.example.edu/duplicate-source" }),
      publish: false,
      actorId: actor.id,
    });
    expect(duplicate).toMatchObject({ ok: false, reason: "duplicate" });

    const record = await db.university.findUniqueOrThrow({
      where: { id: created.id },
      include: { primarySource: true },
    });
    expect(record.verificationStatus).toBe("VERIFIED");
    expect(record.lastVerifiedAt?.toISOString().slice(0, 10)).toBe(
      "2026-11-20",
    );
    expect(record.primarySource.verifiedAt?.toISOString().slice(0, 10)).toBe(
      "2026-11-20",
    );

    const audit = await db.auditEvent.findMany({
      where: { entityType: "UNIVERSITY", entityId: created.id },
      select: { action: true },
    });
    expect(audit.map((event) => event.action)).toContain(
      "admin.university_created",
    );
  });

  it("enforces publish, unpublish, archive, restore, and feature rules", async () => {
    const created = await createAdminUniversity({
      fields: fields(),
      source: source(),
      publish: false,
      actorId: actor.id,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(
      await setUniversityFeatured({
        id: created.id,
        featured: true,
        actorId: actor.id,
      }),
    ).toMatchObject({ ok: false, reason: "not_published" });

    expect(
      await applyUniversityStatusAction({
        id: created.id,
        action: "PUBLISH",
        actorId: actor.id,
      }),
    ).toMatchObject({ ok: true });
    expect(
      await setUniversityFeatured({
        id: created.id,
        featured: true,
        actorId: actor.id,
      }),
    ).toMatchObject({ ok: true });

    expect(
      await applyUniversityStatusAction({
        id: created.id,
        action: "UNPUBLISH",
        actorId: actor.id,
      }),
    ).toMatchObject({ ok: true });
    let record = await db.university.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(record.verificationStatus).toBe("UNVERIFIED");
    expect(record.featured).toBe(false);

    expect(
      await applyUniversityStatusAction({
        id: created.id,
        action: "ARCHIVE",
        actorId: actor.id,
      }),
    ).toMatchObject({ ok: true });
    expect(
      await applyUniversityStatusAction({
        id: created.id,
        action: "PUBLISH",
        actorId: actor.id,
      }),
    ).toMatchObject({ ok: false, reason: "invalid_state" });
    expect(
      await applyUniversityStatusAction({
        id: created.id,
        action: "RESTORE",
        actorId: actor.id,
      }),
    ).toMatchObject({ ok: true });
    record = await db.university.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(record.verificationStatus).toBe("UNVERIFIED");

    const reviewDecisions = await db.catalogReview.findMany({
      where: { entityType: "UNIVERSITY", entityId: created.id },
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
    const created = await createAdminUniversity({
      fields: fields(),
      source: source(),
      publish: true,
      actorId: actor.id,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const verified = await verifyUniversitySource({
      id: created.id,
      verifiedAt: "2026-12-01",
      actorId: actor.id,
    });
    expect(verified.ok).toBe(true);

    const record = await db.university.findUniqueOrThrow({
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
    const zulu = await createAdminUniversity({
      fields: fields({ name: "Zulu University", slug: "zulu-university" }),
      source: source({ url: "https://www.example.edu/zulu-source" }),
      publish: true,
      actorId: actor.id,
    });
    expect(zulu.ok).toBe(true);
    if (!zulu.ok) return;

    const alpha = await createAdminUniversity({
      fields: fields({
        name: "Alpha University",
        slug: "alpha-university",
        city: "Hamburg",
        websiteUrl: "",
      }),
      source: source({ url: "https://www.example.edu/alpha-source" }),
      publish: true,
      actorId: actor.id,
    });
    expect(alpha.ok).toBe(true);
    if (!alpha.ok) return;

    await setUniversityFeatured({
      id: zulu.id,
      featured: true,
      actorId: actor.id,
    });

    const detail = await getAdminUniversity(alpha.id);
    expect(detail?.warnings).toContain(
      "No verified official website is stored.",
    );

    const featured = await listAdminUniversities({
      query: "",
      status: null,
      featured: true,
      page: 1,
    });
    expect(featured.items.map((item) => item.id)).toEqual([zulu.id]);

    const publicList = await listUniversities(parseUniversityFilters({}));
    expect(publicList.items[0]?.id).toBe(zulu.id);
    expect(publicList.items[0]?.featured).toBe(true);
  });

  it("exports a neutralised CSV and imports valid rows without partial duplicates", async () => {
    const created = await createAdminUniversity({
      fields: fields({
        description: '=HYPERLINK("https://evil.example") unsafe formula',
      }),
      source: source(),
      publish: true,
      actorId: actor.id,
    });
    expect(created.ok).toBe(true);

    const csv = await exportUniversitiesCsv();
    expect(csv).toContain("\"'=HYPERLINK(");

    const imported = await importUniversitiesCsv({
      csv: [
        "name,city,countryCode,websiteUrl,sourceUrl,sourcePublisher,sourceTitle,sourceAccessedAt,sourceVerifiedAt,publish",
        "CSV University,Paris,FR,https://csv.example.edu,https://csv.example.edu/source,CSV Publisher,CSV source page,2026-11-20,2026-11-20,false",
      ].join("\n"),
      actorId: actor.id,
    });
    expect(imported).toEqual({ created: 1, errors: [] });

    const duplicateImport = await importUniversitiesCsv({
      csv: [
        "name,city,countryCode,sourceUrl,sourcePublisher,sourceTitle,sourceAccessedAt",
        "CSV University,Paris,FR,https://csv.example.edu/other-source,CSV Publisher,CSV source page,2026-11-20",
      ].join("\n"),
      actorId: actor.id,
    });
    expect(duplicateImport.created).toBe(0);
    expect(duplicateImport.errors[0]).toContain("duplicate university");
  });

  it("unpublishes when a full editor save drops the publish flag", async () => {
    const created = await createAdminUniversity({
      fields: fields(),
      source: source(),
      publish: true,
      actorId: actor.id,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = await updateAdminUniversity({
      id: created.id,
      fields: fields({
        description: "Updated description for this university.",
      }),
      source: source(),
      publish: false,
      actorId: actor.id,
    });
    expect(updated.ok).toBe(true);

    const record = await db.university.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(record.verificationStatus).toBe("UNVERIFIED");
    expect(record.description).toBe("Updated description for this university.");
  });
});
