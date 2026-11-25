import "server-only";

import type { ReviewDecision, VerificationStatus } from "@prisma/client";

import {
  type AdminSourceInput,
  scholarshipFieldInput,
  sourceInputSchema,
  zodFieldErrors,
} from "@/lib/admin/catalog-validation";
import { adminIsoDate, upsertAdminCitation } from "@/lib/admin/catalog-source";
import {
  canFeatureCatalogRecord,
  isoDayString,
  resolveCatalogStatusAction,
  scholarshipDuplicateKey,
  scholarshipMissingInfo,
  slugFromCatalogName,
  type CatalogStatusAction,
} from "@/lib/admin/catalog-management";
import { csvRowsToObjects, parseCsv, toCsv } from "@/lib/admin/csv";
import { recordAuditEvent } from "@/lib/auth/audit";
import { nextReviewDate } from "@/lib/catalog/constants";
import { provenanceIssues } from "@/lib/catalog/provenance";
import { scholarshipFieldsSchema } from "@/lib/catalog/review-validation";
import { db } from "@/lib/db";
import { logError } from "@/lib/observability/logger";

export type ScholarshipDuplicateCandidate = {
  id: string;
  slug: string;
  name: string;
  providerName: string;
};

export type AdminScholarshipMutationResult =
  | { ok: true; id: string; warning?: string }
  | {
      ok: false;
      reason?: string;
      message: string;
      fieldErrors?: Record<string, string>;
      duplicates?: ScholarshipDuplicateCandidate[];
    };

export type AdminScholarshipDetail = {
  id: string;
  slug: string;
  name: string;
  providerName: string;
  providerUrl: string;
  hostCountryCode: string | null;
  fundingType: string;
  degreeLevels: string[];
  nationalityScope: string;
  eligibleNationalities: string[];
  fieldScope: string;
  fields: string[];
  summary: string;
  status: VerificationStatus;
  featured: boolean;
  lastVerifiedAt: string | null;
  nextReviewAt: string | null;
  source: AdminSourceInput;
  requirementCount: number;
  deadlineCount: number;
  warnings: string[];
  duplicates: ScholarshipDuplicateCandidate[];
  reviews: {
    id: string;
    decision: string;
    fromStatus: string | null;
    toStatus: string;
    note: string | null;
    createdAt: string;
  }[];
};

export async function findScholarshipDuplicates(
  input: { name: string; providerName: string },
  excludeId?: string,
): Promise<ScholarshipDuplicateCandidate[]> {
  const rows = await db.scholarship.findMany({
    select: { id: true, slug: true, name: true, providerName: true },
  });
  const key = scholarshipDuplicateKey(input);
  return rows.filter(
    (row) => row.id !== excludeId && scholarshipDuplicateKey(row) === key,
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
      entityType: "SCHOLARSHIP",
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
    action: `admin.scholarship_${input.decision.toLowerCase()}`,
    entityType: "SCHOLARSHIP",
    entityId: input.entityId,
    metadata: { fromStatus: input.fromStatus, toStatus: input.toStatus },
    ip: input.ip,
  });
}

function parseFields(
  raw: unknown,
):
  | { ok: true; fields: Record<string, unknown> }
  | { ok: false; fieldErrors: Record<string, string> } {
  const parsed = scholarshipFieldsSchema.safeParse(
    scholarshipFieldInput(
      raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {},
    ),
  );
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodFieldErrors(parsed.error) };
  }
  return { ok: true, fields: parsed.data as Record<string, unknown> };
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

/**
 * Publishing is a public promise. Reuse the provenance contract as a final
 * guard so an inconsistent source can never be served as verified.
 */
function publishProvenanceErrors(
  source: AdminSourceInput,
): Record<string, string> | null {
  if (!source.verifiedAt) return null;
  const verifiedAt = adminIsoDate(source.verifiedAt);
  const issues = provenanceIssues({
    status: "VERIFIED",
    verifiedAt: isoDayString(verifiedAt),
    nextReviewAt: isoDayString(nextReviewDate(verifiedAt)),
    source: { url: source.url, verifiedAt: source.verifiedAt },
  });
  if (issues.length === 0) return null;
  return Object.fromEntries(
    issues.map((issue) => [
      issue.path.map(String).join(".") || "form",
      issue.message,
    ]),
  );
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

export async function getAdminScholarship(
  id: string,
): Promise<AdminScholarshipDetail | null> {
  const row = await db.scholarship.findUnique({
    where: { id },
    include: {
      primarySource: true,
      _count: { select: { requirements: true, deadlineFacts: true } },
    },
  });
  if (!row) return null;

  const sourceVerifiedAt = isoDayString(row.primarySource.verifiedAt);
  const duplicates = await findScholarshipDuplicates(row, row.id);
  const reviews = await db.catalogReview.findMany({
    where: { entityType: "SCHOLARSHIP", entityId: row.id },
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
    providerName: row.providerName,
    providerUrl: row.providerUrl,
    hostCountryCode: row.hostCountryCode,
    fundingType: row.fundingType,
    degreeLevels: row.degreeLevels,
    nationalityScope: row.nationalityScope,
    eligibleNationalities: row.eligibleNationalities,
    fieldScope: row.fieldScope,
    fields: row.fields,
    summary: row.summary,
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
    requirementCount: row._count.requirements,
    deadlineCount: row._count.deadlineFacts,
    warnings: scholarshipMissingInfo({
      status: row.verificationStatus,
      sourceVerifiedAt,
      nextReviewAt: isoDayString(row.nextReviewAt),
      summary: row.summary,
      providerUrl: row.providerUrl,
      hostCountryCode: row.hostCountryCode,
      degreeLevels: row.degreeLevels,
      fields: row.fields,
      nationalityScope: row.nationalityScope,
      requirementCount: row._count.requirements,
      deadlineCount: row._count.deadlineFacts,
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

export async function createAdminScholarship(input: {
  fields: unknown;
  source: unknown;
  publish: boolean;
  actorId: string;
  ip?: string;
}): Promise<AdminScholarshipMutationResult> {
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
  const fields = fieldsResult.fields;
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
  if (input.publish) {
    const provenanceErrors = publishProvenanceErrors(source);
    if (provenanceErrors) {
      return {
        ok: false,
        reason: "invalid_provenance",
        message: "The source cannot support a published claim.",
        fieldErrors: provenanceErrors,
      };
    }
  }

  const duplicates = await findScholarshipDuplicates({
    name: String(fields.name),
    providerName: String(fields.providerName),
  });
  if (duplicates.length > 0) {
    return {
      ok: false,
      reason: "duplicate",
      message: "A scholarship with the same name and provider already exists.",
      duplicates,
    };
  }

  try {
    const citationId = await upsertAdminCitation(source, input.actorId);
    const verifiedAt = input.publish
      ? adminIsoDate(source.verifiedAt as string)
      : null;
    const status = input.publish
      ? {
          verificationStatus: "VERIFIED" as VerificationStatus,
          lastVerifiedAt: verifiedAt,
          nextReviewAt: nextReviewDate(verifiedAt as Date),
        }
      : unpublishedStatus(source.verifiedAt);

    const record = await db.scholarship.create({
      data: {
        name: String(fields.name),
        slug: String(fields.slug),
        providerName: String(fields.providerName),
        providerUrl: String(fields.providerUrl),
        hostCountryCode: (fields.hostCountryCode as string | null) ?? null,
        fundingType: fields.fundingType as never,
        degreeLevels: fields.degreeLevels as never,
        nationalityScope: fields.nationalityScope as never,
        eligibleNationalities: fields.eligibleNationalities as never,
        fieldScope: fields.fieldScope as never,
        fields: fields.fields as never,
        summary: String(fields.summary),
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
      action: "admin.scholarship_created",
      entityType: "SCHOLARSHIP",
      entityId: record.id,
      metadata: { status: status.verificationStatus },
      ip: input.ip,
    });

    return { ok: true, id: record.id };
  } catch (error) {
    logError("admin.scholarship_create_failed", error, {
      action: "create_scholarship",
    });
    return {
      ok: false,
      reason: "write_failed",
      message:
        "The scholarship could not be saved. Check that the slug and source URL are unique.",
    };
  }
}

export async function updateAdminScholarship(input: {
  id: string;
  fields: unknown;
  source: unknown;
  publish: boolean;
  actorId: string;
  ip?: string;
}): Promise<AdminScholarshipMutationResult> {
  const existing = await db.scholarship.findUnique({
    where: { id: input.id },
    select: { verificationStatus: true, featured: true },
  });
  if (!existing) {
    return {
      ok: false,
      reason: "not_found",
      message: "That scholarship no longer exists.",
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
  const fields = fieldsResult.fields;
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
  if (input.publish) {
    const provenanceErrors = publishProvenanceErrors(source);
    if (provenanceErrors) {
      return {
        ok: false,
        reason: "invalid_provenance",
        message: "The source cannot support a published claim.",
        fieldErrors: provenanceErrors,
      };
    }
  }

  const duplicates = await findScholarshipDuplicates(
    {
      name: String(fields.name),
      providerName: String(fields.providerName),
    },
    input.id,
  );
  if (duplicates.length > 0) {
    return {
      ok: false,
      reason: "duplicate",
      message: "Another scholarship uses the same name and provider.",
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

    await db.scholarship.update({
      where: { id: input.id },
      data: {
        name: String(fields.name),
        slug: String(fields.slug),
        providerName: String(fields.providerName),
        providerUrl: String(fields.providerUrl),
        hostCountryCode: (fields.hostCountryCode as string | null) ?? null,
        fundingType: fields.fundingType as never,
        degreeLevels: fields.degreeLevels as never,
        nationalityScope: fields.nationalityScope as never,
        eligibleNationalities: fields.eligibleNationalities as never,
        fieldScope: fields.fieldScope as never,
        fields: fields.fields as never,
        summary: String(fields.summary),
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
      action: "admin.scholarship_updated",
      entityType: "SCHOLARSHIP",
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
    logError("admin.scholarship_update_failed", error, {
      action: "update_scholarship",
    });
    return {
      ok: false,
      reason: "write_failed",
      message: "The scholarship could not be saved.",
    };
  }
}

export async function applyScholarshipStatusAction(input: {
  id: string;
  action: CatalogStatusAction;
  note?: string | null;
  actorId: string;
  ip?: string;
}): Promise<AdminScholarshipMutationResult> {
  const existing = await db.scholarship.findUnique({
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
      message: "That scholarship no longer exists.",
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
      not_found: "That scholarship no longer exists.",
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

  await db.scholarship.update({
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

export async function setScholarshipFeatured(input: {
  id: string;
  featured: boolean;
  actorId: string;
  ip?: string;
}): Promise<AdminScholarshipMutationResult> {
  const existing = await db.scholarship.findUnique({
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
      message: "That scholarship no longer exists.",
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
        not_found: "That scholarship no longer exists.",
        not_published: "Only a published scholarship can be featured.",
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

  await db.scholarship.update({
    where: { id: input.id },
    data: { featured: input.featured },
  });
  await recordAuditEvent({
    actorId: input.actorId,
    action: input.featured
      ? "admin.scholarship_featured"
      : "admin.scholarship_unfeatured",
    entityType: "SCHOLARSHIP",
    entityId: input.id,
    metadata: { featured: input.featured },
    ip: input.ip,
  });

  return { ok: true, id: input.id };
}

export async function verifyScholarshipSource(input: {
  id: string;
  verifiedAt: string;
  accessedAt?: string | null;
  actorId: string;
  ip?: string;
}): Promise<AdminScholarshipMutationResult> {
  const record = await db.scholarship.findUnique({
    where: { id: input.id },
    select: {
      verificationStatus: true,
      primarySourceId: true,
    },
  });
  if (!record) {
    return {
      ok: false,
      reason: "not_found",
      message: "That scholarship no longer exists.",
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
    await db.scholarship.update({
      where: { id: input.id },
      data: {
        lastVerifiedAt: verifiedAt,
        nextReviewAt: nextReviewDate(verifiedAt),
      },
    });
  }

  await recordAuditEvent({
    actorId: input.actorId,
    action: "admin.scholarship_source_verified",
    entityType: "SCHOLARSHIP",
    entityId: input.id,
    metadata: { verifiedAt: input.verifiedAt },
    ip: input.ip,
  });
  return { ok: true, id: input.id };
}

const SCHOLARSHIP_CSV_HEADERS = [
  "name",
  "slug",
  "providerName",
  "providerUrl",
  "hostCountryCode",
  "fundingType",
  "degreeLevels",
  "nationalityScope",
  "eligibleNationalities",
  "fieldScope",
  "fields",
  "summary",
  "sourceUrl",
  "sourcePublisher",
  "sourceTitle",
  "sourceAccessedAt",
  "sourceVerifiedAt",
  "sourceNotes",
  "publish",
] as const;

export async function exportScholarshipsCsv(): Promise<string> {
  const rows = await db.scholarship.findMany({
    include: { primarySource: true },
    orderBy: { name: "asc" },
  });
  return toCsv([
    [...SCHOLARSHIP_CSV_HEADERS],
    ...rows.map((row) => [
      row.name,
      row.slug,
      row.providerName,
      row.providerUrl,
      row.hostCountryCode ?? "",
      row.fundingType,
      row.degreeLevels.join("|"),
      row.nationalityScope,
      row.eligibleNationalities.join("|"),
      row.fieldScope,
      row.fields.join("|"),
      row.summary,
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

export async function importScholarshipsCsv(input: {
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
      errors: ["Import at most 200 scholarships at a time."],
    };
  }

  const objects = csvRowsToObjects(rows);
  const requiredHeaders = [
    "name",
    "providerName",
    "providerUrl",
    "fundingType",
    "degreeLevels",
    "nationalityScope",
    "fieldScope",
    "summary",
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

  const existing = await db.scholarship.findMany({
    select: { name: true, providerName: true },
  });
  const seen = new Set(existing.map((row) => scholarshipDuplicateKey(row)));

  const prepared: {
    fields: Record<string, unknown>;
    source: AdminSourceInput;
    publish: boolean;
  }[] = [];
  const errors: string[] = [];

  objects.forEach((object, index) => {
    const line = index + 2;
    const fieldsResult = parseFields({
      ...object,
      slug: object.slug || slugFromCatalogName(object.name),
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
    const key = scholarshipDuplicateKey({
      name: String(fieldsResult.fields.name),
      providerName: String(fieldsResult.fields.providerName),
    });
    if (seen.has(key)) {
      errors.push(`Row ${line}: duplicate scholarship name and provider.`);
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
    const result = await createAdminScholarship({
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
