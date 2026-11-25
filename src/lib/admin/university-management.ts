import "server-only";

import type { ReviewDecision, VerificationStatus } from "@prisma/client";

import {
  type AdminSourceInput,
  type AdminUniversityFieldsInput,
  adminUniversityFieldsSchema,
  sourceInputSchema,
  zodFieldErrors,
} from "@/lib/admin/catalog-validation";
import { upsertAdminCitation, adminIsoDate } from "@/lib/admin/catalog-source";
import {
  canFeatureCatalogRecord,
  isoDayString,
  resolveCatalogStatusAction,
  universityDuplicateKey,
  universityMissingInfo,
  type CatalogStatusAction,
} from "@/lib/admin/catalog-management";
import { csvRowsToObjects, parseCsv, toCsv } from "@/lib/admin/csv";
import { recordAuditEvent } from "@/lib/auth/audit";
import { nextReviewDate } from "@/lib/catalog/constants";
import { db } from "@/lib/db";
import { logError } from "@/lib/observability/logger";

export type DuplicateCandidate = {
  id: string;
  slug: string;
  name: string;
  city: string;
  countryCode: string;
};

export type AdminMutationResult =
  | { ok: true; id: string; warning?: string }
  | {
      ok: false;
      reason?: string;
      message: string;
      fieldErrors?: Record<string, string>;
      duplicates?: DuplicateCandidate[];
    };

export type AdminUniversityDetail = {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  city: string;
  countryCode: string;
  websiteUrl: string | null;
  continent: string | null;
  institutionType: string | null;
  logoUrl: string | null;
  description: string | null;
  rankingOrganization: string | null;
  rankingEdition: string | null;
  rankingPosition: number | null;
  rankingDisplay: string | null;
  rankingTied: boolean;
  rankingIsRange: boolean;
  qsNid: number | null;
  status: VerificationStatus;
  featured: boolean;
  lastVerifiedAt: string | null;
  nextReviewAt: string | null;
  source: AdminSourceInput;
  programCount: number;
  warnings: string[];
  duplicates: DuplicateCandidate[];
  reviews: {
    id: string;
    decision: string;
    fromStatus: string | null;
    toStatus: string;
    note: string | null;
    createdAt: string;
  }[];
};

function duplicateKey(input: {
  name: string;
  city: string;
  countryCode: string;
}): string {
  return universityDuplicateKey(input);
}

export async function findUniversityDuplicates(
  input: { name: string; city: string; countryCode: string },
  excludeId?: string,
): Promise<DuplicateCandidate[]> {
  const rows = await db.university.findMany({
    where: { countryCode: input.countryCode.toUpperCase() },
    select: {
      id: true,
      slug: true,
      name: true,
      city: true,
      countryCode: true,
    },
  });
  const key = duplicateKey(input);
  return rows.filter(
    (row) => row.id !== excludeId && duplicateKey(row) === key,
  );
}

async function writeReview(input: {
  entityId: string;
  decision: ReviewDecision;
  fromStatus: VerificationStatus | null;
  toStatus: VerificationStatus;
  note: string;
  actorId: string;
  ip?: string;
}): Promise<void> {
  await db.catalogReview.create({
    data: {
      entityType: "UNIVERSITY",
      entityId: input.entityId,
      decision: input.decision,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      note: input.note,
      reviewerId: input.actorId,
    },
  });
  await recordAuditEvent({
    actorId: input.actorId,
    action: `admin.university_${input.decision.toLowerCase()}`,
    entityType: "UNIVERSITY",
    entityId: input.entityId,
    metadata: { fromStatus: input.fromStatus, toStatus: input.toStatus },
    ip: input.ip,
  });
}

function parseFields(
  raw: unknown,
):
  | { ok: true; fields: AdminUniversityFieldsInput }
  | { ok: false; fieldErrors: Record<string, string> } {
  const parsed = adminUniversityFieldsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodFieldErrors(parsed.error) };
  }
  return { ok: true, fields: parsed.data };
}

function parseSource(
  raw: unknown,
):
  | { ok: true; source: AdminSourceInput }
  | { ok: false; fieldErrors: Record<string, string> } {
  const parsed = sourceInputSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors = zodFieldErrors(parsed.error);
    return {
      ok: false,
      fieldErrors: Object.fromEntries(
        Object.entries(fieldErrors).map(([key, value]) => [
          key.startsWith("source") ? key : `source.${key}`,
          value,
        ]),
      ),
    };
  }
  return { ok: true, source: parsed.data };
}

function unpublishedStatus(verifiedAt: string | null): {
  verificationStatus: VerificationStatus;
  lastVerifiedAt: null;
  nextReviewAt: null;
} {
  return {
    verificationStatus: (verifiedAt
      ? "NEEDS_REVIEW"
      : "UNVERIFIED") as VerificationStatus,
    lastVerifiedAt: null,
    nextReviewAt: null,
  };
}

export async function getAdminUniversity(
  id: string,
): Promise<AdminUniversityDetail | null> {
  const row = await db.university.findUnique({
    where: { id },
    include: {
      primarySource: true,
      _count: { select: { programs: true } },
    },
  });
  if (!row) return null;

  const sourceVerifiedAt = isoDayString(row.primarySource.verifiedAt);
  const duplicates = await findUniversityDuplicates(row, row.id);
  const reviews = await db.catalogReview.findMany({
    where: { entityType: "UNIVERSITY", entityId: row.id },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: {
      id: true,
      decision: true,
      fromStatus: true,
      toStatus: true,
      note: true,
      createdAt: true,
    },
  });

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.shortName,
    city: row.city,
    countryCode: row.countryCode,
    websiteUrl: row.websiteUrl,
    continent: row.continent,
    institutionType: row.institutionType,
    logoUrl: row.logoUrl,
    description: row.description,
    rankingOrganization: row.rankingOrganization,
    rankingEdition: row.rankingEdition,
    rankingPosition: row.rankingPosition,
    rankingDisplay: row.rankingDisplay,
    rankingTied: row.rankingTied,
    rankingIsRange: row.rankingIsRange,
    qsNid: row.qsNid,
    status: row.verificationStatus,
    featured: row.featured,
    lastVerifiedAt: isoDayString(row.lastVerifiedAt),
    nextReviewAt: isoDayString(row.nextReviewAt),
    source: {
      url: row.primarySource.url,
      publisher: row.primarySource.publisher,
      title: row.primarySource.title,
      accessedAt: isoDayString(row.primarySource.accessedAt) ?? "",
      verifiedAt: sourceVerifiedAt,
      notes: row.primarySource.notes,
    },
    programCount: row._count.programs,
    warnings: universityMissingInfo({
      status: row.verificationStatus,
      sourceVerifiedAt,
      nextReviewAt: isoDayString(row.nextReviewAt),
      websiteUrl: row.websiteUrl,
      description: row.description,
      continent: row.continent,
      institutionType: row.institutionType,
      rankingDisplay: row.rankingDisplay,
      programCount: row._count.programs,
    }),
    duplicates,
    reviews: reviews.map((review) => ({
      ...review,
      decision: String(review.decision),
      fromStatus: review.fromStatus ? String(review.fromStatus) : null,
      toStatus: String(review.toStatus),
      createdAt: review.createdAt.toISOString().slice(0, 10),
    })),
  };
}

export async function createAdminUniversity(input: {
  fields: unknown;
  source: unknown;
  publish: boolean;
  actorId: string;
  ip?: string;
}): Promise<AdminMutationResult> {
  const fieldsResult = parseFields(input.fields);
  const sourceResult = parseSource(input.source);
  if (!fieldsResult.ok || !sourceResult.ok) {
    return {
      ok: false,
      reason: "invalid_input",
      message: "Check the highlighted fields.",
      fieldErrors: {
        ...(fieldsResult.ok ? {} : fieldsResult.fieldErrors),
        ...(sourceResult.ok ? {} : sourceResult.fieldErrors),
      },
    };
  }
  const { fields } = fieldsResult;
  const { source } = sourceResult;

  if (input.publish && !source.verifiedAt) {
    return {
      ok: false,
      reason: "source_unverified",
      message: "Enter the source verification date before publishing.",
      fieldErrors: {
        "source.verifiedAt": "Enter the date you checked the source.",
      },
    };
  }

  const duplicates = await findUniversityDuplicates(fields);
  if (duplicates.length > 0) {
    return {
      ok: false,
      reason: "duplicate",
      message: "A university with the same name and location already exists.",
      duplicates,
    };
  }

  try {
    const citationId = await upsertAdminCitation(source, input.actorId);
    const status = input.publish
      ? {
          verificationStatus: "VERIFIED" as VerificationStatus,
          lastVerifiedAt: adminIsoDate(source.verifiedAt as string),
          nextReviewAt: nextReviewDate(
            adminIsoDate(source.verifiedAt as string),
          ),
        }
      : unpublishedStatus(source.verifiedAt);

    const record = await db.university.create({
      data: {
        ...fields,
        ...status,
        featured: false,
        primarySourceId: citationId,
      },
      select: { id: true },
    });

    await writeReview({
      entityId: record.id,
      decision: "IMPORT",
      fromStatus: null,
      toStatus: status.verificationStatus,
      note: "Created in the administration panel.",
      actorId: input.actorId,
      ip: input.ip,
    });
    await recordAuditEvent({
      actorId: input.actorId,
      action: "admin.university_created",
      entityType: "UNIVERSITY",
      entityId: record.id,
      metadata: { status: status.verificationStatus },
      ip: input.ip,
    });

    return { ok: true, id: record.id };
  } catch (error) {
    logError("admin.university_create_failed", error, {
      action: "create_university",
    });
    return {
      ok: false,
      reason: "write_failed",
      message:
        "The university could not be saved. Check that the slug and source URL are unique.",
    };
  }
}

export async function updateAdminUniversity(input: {
  id: string;
  fields: unknown;
  source: unknown;
  publish: boolean;
  actorId: string;
  ip?: string;
}): Promise<AdminMutationResult> {
  const existing = await db.university.findUnique({
    where: { id: input.id },
    select: {
      verificationStatus: true,
      featured: true,
    },
  });
  if (!existing) {
    return {
      ok: false,
      reason: "not_found",
      message: "That university no longer exists.",
    };
  }

  const fieldsResult = parseFields(input.fields);
  const sourceResult = parseSource(input.source);
  if (!fieldsResult.ok || !sourceResult.ok) {
    return {
      ok: false,
      reason: "invalid_input",
      message: "Check the highlighted fields.",
      fieldErrors: {
        ...(fieldsResult.ok ? {} : fieldsResult.fieldErrors),
        ...(sourceResult.ok ? {} : sourceResult.fieldErrors),
      },
    };
  }
  const { fields } = fieldsResult;
  const { source } = sourceResult;

  if (input.publish && !source.verifiedAt) {
    return {
      ok: false,
      reason: "source_unverified",
      message: "Enter the source verification date before publishing.",
      fieldErrors: {
        "source.verifiedAt": "Enter the date you checked the source.",
      },
    };
  }

  const duplicates = await findUniversityDuplicates(fields, input.id);
  if (duplicates.length > 0) {
    return {
      ok: false,
      reason: "duplicate",
      message: "Another university uses the same name and location.",
      duplicates,
    };
  }

  try {
    const citationId = await upsertAdminCitation(source, input.actorId);
    let status: {
      verificationStatus: VerificationStatus;
      lastVerifiedAt: Date | null;
      nextReviewAt: Date | null;
    };
    if (input.publish) {
      const verifiedAt = adminIsoDate(source.verifiedAt as string);
      status = {
        verificationStatus: "VERIFIED",
        lastVerifiedAt: verifiedAt,
        nextReviewAt: nextReviewDate(verifiedAt),
      };
    } else if (existing.verificationStatus === "ARCHIVED") {
      status = {
        verificationStatus: "ARCHIVED",
        lastVerifiedAt: null,
        nextReviewAt: null,
      };
    } else if (existing.verificationStatus === "VERIFIED") {
      status = {
        verificationStatus: "UNVERIFIED",
        lastVerifiedAt: null,
        nextReviewAt: null,
      };
    } else {
      status = unpublishedStatus(source.verifiedAt);
    }

    const keepFeatured =
      existing.featured &&
      status.verificationStatus === "VERIFIED" &&
      Boolean(source.verifiedAt);

    await db.university.update({
      where: { id: input.id },
      data: {
        ...fields,
        ...status,
        featured: keepFeatured,
        primarySourceId: citationId,
      },
    });

    await writeReview({
      entityId: input.id,
      decision: "EDIT",
      fromStatus: existing.verificationStatus,
      toStatus: status.verificationStatus,
      note: input.publish
        ? "Profile and source updated; published."
        : "Profile or source updated; not published.",
      actorId: input.actorId,
      ip: input.ip,
    });
    await recordAuditEvent({
      actorId: input.actorId,
      action: "admin.university_updated",
      entityType: "UNIVERSITY",
      entityId: input.id,
      metadata: {
        fromStatus: existing.verificationStatus,
        toStatus: status.verificationStatus,
        featuredChanged: existing.featured !== keepFeatured,
      },
      ip: input.ip,
    });

    return { ok: true, id: input.id };
  } catch (error) {
    logError("admin.university_update_failed", error, {
      action: "update_university",
    });
    return {
      ok: false,
      reason: "write_failed",
      message: "The university could not be saved.",
    };
  }
}

export async function applyUniversityStatusAction(input: {
  id: string;
  action: CatalogStatusAction;
  note?: string | null;
  actorId: string;
  ip?: string;
}): Promise<AdminMutationResult> {
  const existing = await db.university.findUnique({
    where: { id: input.id },
    select: {
      verificationStatus: true,
      featured: true,
      primarySource: { select: { verifiedAt: true } },
    },
  });
  if (!existing) {
    return {
      ok: false,
      reason: "not_found",
      message: "That university no longer exists.",
    };
  }

  const sourceVerifiedAt = isoDayString(existing.primarySource.verifiedAt);
  const transition = resolveCatalogStatusAction(
    input.action,
    existing.verificationStatus,
    sourceVerifiedAt,
  );
  if (!transition.ok) {
    const messages = {
      not_found: "That university no longer exists.",
      invalid_action: "Choose a valid status action.",
      invalid_state: "That action is not available in the current state.",
      source_unverified:
        "Verify the primary source with a date before publishing.",
    } as const;
    return {
      ok: false,
      reason: transition.reason,
      message: messages[transition.reason],
    };
  }

  const update = transition.update;
  const keepFeatured =
    existing.featured &&
    update.status === "VERIFIED" &&
    Boolean(sourceVerifiedAt);

  await db.university.update({
    where: { id: input.id },
    data: {
      verificationStatus: update.status as VerificationStatus,
      lastVerifiedAt: update.lastVerifiedAt,
      nextReviewAt: update.nextReviewAt,
      featured: keepFeatured,
    },
  });
  await writeReview({
    entityId: input.id,
    decision: update.decision,
    fromStatus: existing.verificationStatus,
    toStatus: update.status as VerificationStatus,
    note:
      input.note?.trim() || `Administrator changed status to ${update.status}.`,
    actorId: input.actorId,
    ip: input.ip,
  });

  return { ok: true, id: input.id };
}

export async function setUniversityFeatured(input: {
  id: string;
  featured: boolean;
  actorId: string;
  ip?: string;
}): Promise<AdminMutationResult> {
  const existing = await db.university.findUnique({
    where: { id: input.id },
    select: {
      verificationStatus: true,
      featured: true,
      primarySource: { select: { verifiedAt: true } },
    },
  });
  if (!existing) {
    return {
      ok: false,
      reason: "not_found",
      message: "That university no longer exists.",
    };
  }
  if (existing.featured === input.featured) {
    return {
      ok: true,
      id: input.id,
      warning: "The featured state is unchanged.",
    };
  }

  if (input.featured) {
    const rule = canFeatureCatalogRecord({
      status: existing.verificationStatus,
      sourceVerifiedAt: isoDayString(existing.primarySource.verifiedAt),
    });
    if (!rule.ok) {
      const messages = {
        not_found: "That university no longer exists.",
        not_published: "Only a published university can be featured.",
        source_unverified:
          "Verify the primary source before featuring this record.",
      } as const;
      return {
        ok: false,
        reason: rule.reason,
        message: messages[rule.reason],
      };
    }
  }

  await db.university.update({
    where: { id: input.id },
    data: { featured: input.featured },
  });
  await recordAuditEvent({
    actorId: input.actorId,
    action: input.featured
      ? "admin.university_featured"
      : "admin.university_unfeatured",
    entityType: "UNIVERSITY",
    entityId: input.id,
    metadata: { featured: input.featured },
    ip: input.ip,
  });

  return { ok: true, id: input.id };
}

export async function verifyUniversitySource(input: {
  id: string;
  verifiedAt: string;
  accessedAt?: string | null;
  actorId: string;
  ip?: string;
}): Promise<AdminMutationResult> {
  const record = await db.university.findUnique({
    where: { id: input.id },
    select: {
      verificationStatus: true,
      primarySourceId: true,
      featured: true,
    },
  });
  if (!record) {
    return {
      ok: false,
      reason: "not_found",
      message: "That university no longer exists.",
    };
  }

  const verifiedAt = adminIsoDate(input.verifiedAt);
  const updated = await db.sourceCitation.updateMany({
    where: { id: record.primarySourceId },
    data: {
      verifiedAt,
      ...(input.accessedAt
        ? { accessedAt: adminIsoDate(input.accessedAt) }
        : {}),
    },
  });
  if (updated.count === 0) {
    return {
      ok: false,
      reason: "not_found",
      message: "The primary source is missing.",
    };
  }

  if (record.verificationStatus === "VERIFIED") {
    await db.university.update({
      where: { id: input.id },
      data: {
        lastVerifiedAt: verifiedAt,
        nextReviewAt: nextReviewDate(verifiedAt),
      },
    });
  }

  await recordAuditEvent({
    actorId: input.actorId,
    action: "admin.university_source_verified",
    entityType: "UNIVERSITY",
    entityId: input.id,
    metadata: { verifiedAt: input.verifiedAt },
    ip: input.ip,
  });
  return { ok: true, id: input.id };
}

const UNIVERSITY_CSV_HEADERS = [
  "name",
  "slug",
  "shortName",
  "city",
  "countryCode",
  "websiteUrl",
  "continent",
  "institutionType",
  "logoUrl",
  "description",
  "rankingOrganization",
  "rankingEdition",
  "rankingPosition",
  "rankingDisplay",
  "rankingTied",
  "rankingIsRange",
  "qsNid",
  "sourceUrl",
  "sourcePublisher",
  "sourceTitle",
  "sourceAccessedAt",
  "sourceVerifiedAt",
  "sourceNotes",
  "publish",
] as const;

export async function exportUniversitiesCsv(): Promise<string> {
  const rows = await db.university.findMany({
    include: { primarySource: true },
    orderBy: { name: "asc" },
  });
  return toCsv([
    [...UNIVERSITY_CSV_HEADERS],
    ...rows.map((row) => [
      row.name,
      row.slug,
      row.shortName ?? "",
      row.city,
      row.countryCode,
      row.websiteUrl ?? "",
      row.continent ?? "",
      row.institutionType ?? "",
      row.logoUrl ?? "",
      row.description ?? "",
      row.rankingOrganization ?? "",
      row.rankingEdition ?? "",
      row.rankingPosition === null ? "" : String(row.rankingPosition),
      row.rankingDisplay ?? "",
      String(row.rankingTied),
      String(row.rankingIsRange),
      row.qsNid === null ? "" : String(row.qsNid),
      row.primarySource.url,
      row.primarySource.publisher,
      row.primarySource.title,
      row.primarySource.accessedAt.toISOString().slice(0, 10),
      isoDayString(row.primarySource.verifiedAt) ?? "",
      row.primarySource.notes ?? "",
      String(row.verificationStatus === "VERIFIED"),
    ]),
  ]);
}

export type CsvImportOutcome = {
  created: number;
  errors: string[];
};

export async function importUniversitiesCsv(input: {
  csv: string;
  actorId: string;
  ip?: string;
}): Promise<CsvImportOutcome> {
  let rows: string[][];
  try {
    rows = parseCsv(input.csv);
  } catch (error) {
    return {
      created: 0,
      errors: [
        error instanceof Error ? error.message : "The CSV could not be read.",
      ],
    };
  }
  if (rows.length < 2) {
    return {
      created: 0,
      errors: ["The CSV needs a header row and at least one record."],
    };
  }
  if (rows.length > 201) {
    return {
      created: 0,
      errors: ["Import at most 200 universities at a time."],
    };
  }

  const objects = csvRowsToObjects(rows);
  const requiredHeaders = [
    "name",
    "city",
    "countryCode",
    "sourceUrl",
    "sourcePublisher",
    "sourceTitle",
    "sourceAccessedAt",
  ];
  const header = rows[0].map((cell) => cell.trim());
  const missing = requiredHeaders.filter((name) => !header.includes(name));
  if (missing.length > 0) {
    return {
      created: 0,
      errors: [`Missing required columns: ${missing.join(", ")}.`],
    };
  }

  const existing = await db.university.findMany({
    select: { id: true, name: true, city: true, countryCode: true },
  });
  const seen = new Set(
    existing.map((row) =>
      universityDuplicateKey({
        name: row.name,
        city: row.city,
        countryCode: row.countryCode,
      }),
    ),
  );

  const prepared: {
    fields: AdminUniversityFieldsInput;
    source: AdminSourceInput;
    publish: boolean;
  }[] = [];
  const errors: string[] = [];

  objects.forEach((object, index) => {
    const line = index + 2;
    const fieldsResult = parseFields({
      ...object,
      slug:
        object.slug ||
        object.name
          .toLocaleLowerCase("en")
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 100),
    });
    const sourceResult = parseSource({
      url: object.sourceUrl,
      publisher: object.sourcePublisher,
      title: object.sourceTitle,
      accessedAt: object.sourceAccessedAt,
      verifiedAt: object.sourceVerifiedAt ?? null,
      notes: object.sourceNotes ?? "",
    });
    if (!fieldsResult.ok || !sourceResult.ok) {
      errors.push(
        `Row ${line}: ${[
          ...(fieldsResult.ok
            ? []
            : Object.entries(fieldsResult.fieldErrors).map(
                ([key, message]) => `${key}: ${message}`,
              )),
          ...(sourceResult.ok
            ? []
            : Object.entries(sourceResult.fieldErrors).map(
                ([key, message]) => `${key}: ${message}`,
              )),
        ].join(" ")}`.trim(),
      );
      return;
    }
    const publish = object.publish === "true" || object.publish === "1";
    if (publish && !sourceResult.source.verifiedAt) {
      errors.push(`Row ${line}: a published row needs sourceVerifiedAt.`);
      return;
    }
    const key = universityDuplicateKey(fieldsResult.fields);
    if (seen.has(key)) {
      errors.push(`Row ${line}: duplicate university name and location.`);
      return;
    }
    seen.add(key);
    prepared.push({
      fields: fieldsResult.fields,
      source: sourceResult.source,
      publish,
    });
  });

  if (errors.length > 0) {
    return { created: 0, errors };
  }

  let created = 0;
  for (const row of prepared) {
    const result = await createAdminUniversity({
      fields: row.fields,
      source: row.source,
      publish: row.publish,
      actorId: input.actorId,
      ip: input.ip,
    });
    if (result.ok) created += 1;
    else errors.push(result.message);
  }

  return { created, errors };
}
