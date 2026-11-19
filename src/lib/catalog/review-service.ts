import "server-only";

import type {
  CatalogEntityType,
  DegreeLevel,
  EligibilityScope,
  FundingType,
  RequirementKind,
  ReviewDecision,
  VerificationStatus,
} from "@prisma/client";

import { db } from "@/lib/db";
import { logError } from "@/lib/observability/logger";
import { recordAuditEvent } from "@/lib/auth/audit";
import {
  REVIEW_INTERVAL_DAYS,
  nextReviewDate,
  type CatalogEntityTypeValue,
} from "@/lib/catalog/constants";
import type {
  DeadlineInput,
  ImportFactsInput,
  ProgramFieldsInput,
  RequirementInput,
  ScholarshipFieldsInput,
  SourceInput,
  TuitionInput,
  UniversityFieldsInput,
} from "@/lib/catalog/review-validation";
import { amountToMinor } from "@/lib/catalog/review-validation";

/**
 * Reviewer writes.
 *
 * Every write goes through one of these functions so that three invariants hold
 * together: the record has an official source, a `VERIFIED` status always
 * carries a verification date, and a `CatalogReview` plus an audit event is
 * written for every state change.
 */

export type Reviewer = { id: string; ip?: string };

export type ReviewResult =
  | { ok: true; id: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

function isoDateToDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function statusFor(publish: boolean, sourceVerifiedAt: string | null) {
  if (publish) {
    return {
      verificationStatus: "VERIFIED" as VerificationStatus,
      lastVerifiedAt: sourceVerifiedAt ? isoDateToDate(sourceVerifiedAt) : null,
      nextReviewAt: sourceVerifiedAt
        ? nextReviewDate(isoDateToDate(sourceVerifiedAt))
        : null,
    };
  }
  return {
    verificationStatus: (sourceVerifiedAt
      ? "NEEDS_REVIEW"
      : "UNVERIFIED") as VerificationStatus,
    lastVerifiedAt: null,
    nextReviewAt: null,
  };
}

async function upsertCitation(
  source: SourceInput,
  reviewer: Reviewer,
): Promise<string> {
  const citation = await db.sourceCitation.upsert({
    where: { url: source.url },
    create: {
      url: source.url,
      publisher: source.publisher,
      title: source.title,
      accessedAt: isoDateToDate(source.accessedAt),
      verifiedAt: source.verifiedAt ? isoDateToDate(source.verifiedAt) : null,
      notes: source.notes,
      createdById: reviewer.id,
    },
    update: {
      publisher: source.publisher,
      title: source.title,
      accessedAt: isoDateToDate(source.accessedAt),
      verifiedAt: source.verifiedAt ? isoDateToDate(source.verifiedAt) : null,
      notes: source.notes,
    },
    select: { id: true },
  });

  return citation.id;
}

async function writeReview(input: {
  entityType: CatalogEntityType;
  entityId: string;
  decision: ReviewDecision;
  fromStatus: VerificationStatus | null;
  toStatus: VerificationStatus;
  note?: string | null;
  reviewer: Reviewer;
}): Promise<void> {
  await db.catalogReview.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      decision: input.decision,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      note: input.note ?? null,
      reviewerId: input.reviewer.id,
    },
  });

  await recordAuditEvent({
    actorId: input.reviewer.id,
    action: `catalog.${input.decision.toLowerCase()}`,
    entityType: input.entityType,
    entityId: input.entityId,
    metadata: {
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
    },
    ip: input.reviewer.ip,
  });
}

function uniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

export async function createUniversity(
  fields: UniversityFieldsInput,
  source: SourceInput,
  publish: boolean,
  reviewer: Reviewer,
): Promise<ReviewResult> {
  try {
    const citationId = await upsertCitation(source, reviewer);
    const status = statusFor(publish, source.verifiedAt);

    const record = await db.university.create({
      data: {
        ...fields,
        ...status,
        primarySourceId: citationId,
      },
      select: { id: true, verificationStatus: true },
    });

    await writeReview({
      entityType: "UNIVERSITY",
      entityId: record.id,
      decision: "IMPORT",
      fromStatus: null,
      toStatus: record.verificationStatus,
      note: "Imported from an official source.",
      reviewer,
    });

    return { ok: true, id: record.id };
  } catch (error) {
    if (uniqueViolation(error)) {
      return {
        ok: false,
        message: "That slug or source URL is already in use.",
        fieldErrors: { slug: "Choose a different slug." },
      };
    }
    logError("catalog.review_operation_failed", error, {
      action: "create_university",
    });
    return { ok: false, message: "The university could not be saved." };
  }
}

export async function createProgram(
  fields: ProgramFieldsInput,
  source: SourceInput,
  facts: ImportFactsInput,
  publish: boolean,
  reviewer: Reviewer,
): Promise<ReviewResult> {
  try {
    const university = await db.university.findUnique({
      where: { id: fields.universityId },
      select: { id: true },
    });
    if (!university) {
      return {
        ok: false,
        message: "Choose an existing university.",
        fieldErrors: { universityId: "Unknown university." },
      };
    }

    const citationId = await upsertCitation(source, reviewer);
    const status = statusFor(publish, source.verifiedAt);

    const record = await db.program.create({
      data: {
        ...fields,
        degreeLevel: fields.degreeLevel as DegreeLevel,
        ...status,
        primarySourceId: citationId,
        requirements: {
          create: facts.requirements.map((fact) => ({
            kind: fact.kind as RequirementKind,
            summary: fact.summary,
            verificationStatus: "VERIFIED" as VerificationStatus,
            sourceId: citationId,
          })),
        },
        tuitionFacts: {
          create: facts.tuition.map((fact) => ({
            amountMinor: amountToMinor(fact.amount),
            currency: fact.currency,
            period: fact.period,
            applicantGroup: fact.applicantGroup,
            note: fact.note,
            verificationStatus: "VERIFIED" as VerificationStatus,
            sourceId: citationId,
          })),
        },
        deadlineFacts: {
          create: facts.deadlines.map((fact) => ({
            ...deadlineData(fact),
            verificationStatus: "VERIFIED" as VerificationStatus,
            sourceId: citationId,
          })),
        },
      },
      select: { id: true, verificationStatus: true },
    });

    await writeReview({
      entityType: "PROGRAM",
      entityId: record.id,
      decision: "IMPORT",
      fromStatus: null,
      toStatus: record.verificationStatus,
      note: "Imported from an official source.",
      reviewer,
    });

    return { ok: true, id: record.id };
  } catch (error) {
    if (uniqueViolation(error)) {
      return {
        ok: false,
        message: "That program slug is already used by this university.",
        fieldErrors: { slug: "Choose a different slug." },
      };
    }
    logError("catalog.review_operation_failed", error, {
      action: "create_program",
    });
    return { ok: false, message: "The program could not be saved." };
  }
}

export async function createScholarship(
  fields: ScholarshipFieldsInput,
  source: SourceInput,
  facts: ImportFactsInput,
  publish: boolean,
  reviewer: Reviewer,
): Promise<ReviewResult> {
  try {
    const citationId = await upsertCitation(source, reviewer);
    const status = statusFor(publish, source.verifiedAt);

    const record = await db.scholarship.create({
      data: {
        ...fields,
        fundingType: fields.fundingType as FundingType,
        nationalityScope: fields.nationalityScope as EligibilityScope,
        fieldScope: fields.fieldScope as EligibilityScope,
        degreeLevels: fields.degreeLevels as DegreeLevel[],
        ...status,
        primarySourceId: citationId,
        requirements: {
          create: facts.requirements.map((fact) => ({
            kind: fact.kind as RequirementKind,
            summary: fact.summary,
            verificationStatus: "VERIFIED" as VerificationStatus,
            sourceId: citationId,
          })),
        },
        deadlineFacts: {
          create: facts.deadlines.map((fact) => ({
            ...deadlineData(fact),
            verificationStatus: "VERIFIED" as VerificationStatus,
            sourceId: citationId,
          })),
        },
      },
      select: { id: true, verificationStatus: true },
    });

    await writeReview({
      entityType: "SCHOLARSHIP",
      entityId: record.id,
      decision: "IMPORT",
      fromStatus: null,
      toStatus: record.verificationStatus,
      note: "Imported from an official source.",
      reviewer,
    });

    return { ok: true, id: record.id };
  } catch (error) {
    if (uniqueViolation(error)) {
      return {
        ok: false,
        message: "That slug or source URL is already in use.",
        fieldErrors: { slug: "Choose a different slug." },
      };
    }
    logError("catalog.review_operation_failed", error, {
      action: "create_scholarship",
    });
    return { ok: false, message: "The scholarship could not be saved." };
  }
}

// ---------------------------------------------------------------------------
// Editing
// ---------------------------------------------------------------------------

async function currentEntity(
  entityType: CatalogEntityType,
  id: string,
): Promise<{
  id: string;
  verificationStatus: VerificationStatus;
  primarySourceId: string;
} | null> {
  if (entityType === "UNIVERSITY") {
    return db.university.findUnique({
      where: { id },
      select: {
        id: true,
        verificationStatus: true,
        primarySourceId: true,
      },
    });
  }
  if (entityType === "PROGRAM") {
    return db.program.findUnique({
      where: { id },
      select: {
        id: true,
        verificationStatus: true,
        primarySourceId: true,
      },
    });
  }
  return db.scholarship.findUnique({
    where: { id },
    select: {
      id: true,
      verificationStatus: true,
      primarySourceId: true,
    },
  });
}

async function updateEntity(
  entityType: CatalogEntityType,
  id: string,
  data: {
    verificationStatus: VerificationStatus;
    lastVerifiedAt?: Date | null;
    nextReviewAt?: Date | null;
  },
): Promise<void> {
  if (entityType === "UNIVERSITY") {
    await db.university.update({ where: { id }, data });
    return;
  }
  if (entityType === "PROGRAM") {
    await db.program.update({ where: { id }, data });
    return;
  }
  await db.scholarship.update({ where: { id }, data });
}

export async function updateRecord(input: {
  entityType: CatalogEntityType;
  id: string;
  source: SourceInput;
  publish: boolean;
  reviewer: Reviewer;
  university?: UniversityFieldsInput;
  program?: ProgramFieldsInput;
  scholarship?: ScholarshipFieldsInput;
}): Promise<ReviewResult> {
  const existing = await currentEntity(input.entityType, input.id);
  if (!existing) return { ok: false, message: "That record no longer exists." };

  if (input.publish && !input.source.verifiedAt) {
    return {
      ok: false,
      message: "A record can only be verified with a verification date.",
      fieldErrors: { verifiedAt: "Enter the date you checked the source." },
    };
  }

  try {
    const citationId = await upsertCitation(input.source, input.reviewer);
    const status = statusFor(input.publish, input.source.verifiedAt);

    if (input.entityType === "UNIVERSITY" && input.university) {
      await db.university.update({
        where: { id: input.id },
        data: {
          ...input.university,
          primarySourceId: citationId,
          ...status,
        },
      });
    } else if (input.entityType === "PROGRAM" && input.program) {
      await db.program.update({
        where: { id: input.id },
        data: {
          ...input.program,
          degreeLevel: input.program.degreeLevel as DegreeLevel,
          primarySourceId: citationId,
          ...status,
        },
      });
    } else if (input.entityType === "SCHOLARSHIP" && input.scholarship) {
      await db.scholarship.update({
        where: { id: input.id },
        data: {
          ...input.scholarship,
          fundingType: input.scholarship.fundingType as FundingType,
          nationalityScope: input.scholarship
            .nationalityScope as EligibilityScope,
          fieldScope: input.scholarship.fieldScope as EligibilityScope,
          degreeLevels: input.scholarship.degreeLevels as DegreeLevel[],
          primarySourceId: citationId,
          ...status,
        },
      });
    } else {
      return { ok: false, message: "The record fields were missing." };
    }

    await writeReview({
      entityType: input.entityType,
      entityId: input.id,
      decision: "EDIT",
      fromStatus: existing.verificationStatus,
      toStatus: status.verificationStatus,
      note: input.publish
        ? "Fields and source updated; re-verified."
        : "Fields or source updated; awaiting re-verification.",
      reviewer: input.reviewer,
    });

    return { ok: true, id: input.id };
  } catch (error) {
    if (uniqueViolation(error)) {
      return {
        ok: false,
        message: "That slug or source URL is already in use.",
        fieldErrors: { slug: "Choose a different slug." },
      };
    }
    logError("catalog.review_operation_failed", error, {
      action: "update_record",
    });
    return { ok: false, message: "The record could not be saved." };
  }
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

const DECISION_TARGETS: Record<
  Exclude<ReviewDecision, "IMPORT" | "EDIT" | "FLAG_STALE">,
  VerificationStatus
> = {
  APPROVE: "VERIFIED",
  REQUEST_CHANGES: "NEEDS_REVIEW",
  EXPIRE: "EXPIRED",
  RESTORE: "NEEDS_REVIEW",
  ARCHIVE: "ARCHIVED",
  MARK_PARTIAL: "PARTIALLY_VERIFIED",
  MARK_UNAVAILABLE: "INFORMATION_UNAVAILABLE",
};

export async function recordDecision(input: {
  entityType: CatalogEntityType;
  id: string;
  decision: keyof typeof DECISION_TARGETS;
  note: string | null;
  reviewer: Reviewer;
}): Promise<ReviewResult> {
  const existing = await currentEntity(input.entityType, input.id);
  if (!existing) return { ok: false, message: "That record no longer exists." };

  const target = DECISION_TARGETS[input.decision];

  let data: {
    verificationStatus: VerificationStatus;
    lastVerifiedAt?: Date | null;
    nextReviewAt?: Date | null;
  } = {
    verificationStatus: target,
    ...(input.decision === "ARCHIVE" ? { nextReviewAt: null } : {}),
  };

  if (input.decision === "APPROVE") {
    const source = await db.sourceCitation.findUnique({
      where: { id: existing.primarySourceId },
      select: { verifiedAt: true },
    });
    if (!source?.verifiedAt) {
      return {
        ok: false,
        message:
          "Update the source with the date you checked it before approving.",
      };
    }
    data = {
      verificationStatus: target,
      lastVerifiedAt: source.verifiedAt,
      nextReviewAt: nextReviewDate(source.verifiedAt),
    };
  }

  try {
    await updateEntity(input.entityType, input.id, data);

    await writeReview({
      entityType: input.entityType,
      entityId: input.id,
      decision: input.decision,
      fromStatus: existing.verificationStatus,
      toStatus: target,
      note: input.note,
      reviewer: input.reviewer,
    });

    return { ok: true, id: input.id };
  } catch (error) {
    logError("catalog.review_operation_failed", error, {
      action: "record_decision",
    });
    return { ok: false, message: "The decision could not be recorded." };
  }
}

// ---------------------------------------------------------------------------
// Facts
// ---------------------------------------------------------------------------

function deadlineData(fact: DeadlineInput) {
  return {
    cycle: fact.cycle,
    applicantGroup: fact.applicantGroup,
    opensOn: fact.opensOn ? isoDateToDate(fact.opensOn) : null,
    deadlineOn: fact.deadlineOn ? isoDateToDate(fact.deadlineOn) : null,
    opensMonthDay: fact.opensMonthDay,
    deadlineMonthDay: fact.deadlineMonthDay,
    note: fact.note,
  };
}

async function primarySourceFor(
  entityType: CatalogEntityType,
  id: string,
): Promise<string | null> {
  const entity = await currentEntity(entityType, id);
  return entity?.primarySourceId ?? null;
}

export async function addRequirement(
  entityType: Exclude<CatalogEntityType, "UNIVERSITY">,
  id: string,
  fact: RequirementInput,
  reviewer: Reviewer,
): Promise<ReviewResult> {
  const sourceId = await primarySourceFor(entityType, id);
  if (!sourceId) return { ok: false, message: "That record no longer exists." };

  try {
    const record =
      entityType === "PROGRAM"
        ? await db.requirement.create({
            data: {
              programId: id,
              kind: fact.kind as RequirementKind,
              summary: fact.summary,
              verificationStatus: "VERIFIED",
              sourceId,
            },
            select: { id: true },
          })
        : await db.requirement.create({
            data: {
              scholarshipId: id,
              kind: fact.kind as RequirementKind,
              summary: fact.summary,
              verificationStatus: "VERIFIED",
              sourceId,
            },
            select: { id: true },
          });

    await recordAuditEvent({
      actorId: reviewer.id,
      action: "catalog.fact_added",
      entityType,
      entityId: id,
      metadata: { factType: "requirement", factId: record.id },
      ip: reviewer.ip,
    });

    return { ok: true, id: record.id };
  } catch (error) {
    logError("catalog.review_operation_failed", error, {
      action: "add_requirement",
    });
    return { ok: false, message: "The requirement could not be saved." };
  }
}

export async function addTuition(
  programId: string,
  fact: TuitionInput,
  reviewer: Reviewer,
): Promise<ReviewResult> {
  const sourceId = await primarySourceFor("PROGRAM", programId);
  if (!sourceId)
    return { ok: false, message: "That program no longer exists." };

  try {
    const record = await db.tuitionFact.create({
      data: {
        programId,
        amountMinor: amountToMinor(fact.amount),
        currency: fact.currency,
        period: fact.period,
        applicantGroup: fact.applicantGroup,
        note: fact.note,
        verificationStatus: "VERIFIED",
        sourceId,
      },
      select: { id: true },
    });

    await recordAuditEvent({
      actorId: reviewer.id,
      action: "catalog.fact_added",
      entityType: "PROGRAM",
      entityId: programId,
      metadata: { factType: "tuition", factId: record.id },
      ip: reviewer.ip,
    });

    return { ok: true, id: record.id };
  } catch (error) {
    logError("catalog.review_operation_failed", error, {
      action: "add_tuition",
    });
    return { ok: false, message: "The tuition fact could not be saved." };
  }
}

export async function addDeadline(
  entityType: Exclude<CatalogEntityType, "UNIVERSITY">,
  id: string,
  fact: DeadlineInput,
  reviewer: Reviewer,
): Promise<ReviewResult> {
  const sourceId = await primarySourceFor(entityType, id);
  if (!sourceId) return { ok: false, message: "That record no longer exists." };

  try {
    const record =
      entityType === "PROGRAM"
        ? await db.deadlineFact.create({
            data: {
              programId: id,
              ...deadlineData(fact),
              verificationStatus: "VERIFIED",
              sourceId,
            },
            select: { id: true },
          })
        : await db.deadlineFact.create({
            data: {
              scholarshipId: id,
              ...deadlineData(fact),
              verificationStatus: "VERIFIED",
              sourceId,
            },
            select: { id: true },
          });

    await recordAuditEvent({
      actorId: reviewer.id,
      action: "catalog.fact_added",
      entityType,
      entityId: id,
      metadata: { factType: "deadline", factId: record.id },
      ip: reviewer.ip,
    });

    return { ok: true, id: record.id };
  } catch (error) {
    logError("catalog.review_operation_failed", error, {
      action: "add_deadline",
    });
    return { ok: false, message: "The deadline could not be saved." };
  }
}

export async function removeFact(
  factType: "requirement" | "tuition" | "deadline",
  factId: string,
  reviewer: Reviewer,
): Promise<ReviewResult> {
  try {
    if (factType === "requirement") {
      const fact = await db.requirement.delete({
        where: { id: factId },
        select: { programId: true, scholarshipId: true },
      });
      await recordAuditEvent({
        actorId: reviewer.id,
        action: "catalog.fact_removed",
        entityType: fact.programId ? "PROGRAM" : "SCHOLARSHIP",
        entityId: fact.programId ?? fact.scholarshipId ?? factId,
        metadata: { factType, factId },
        ip: reviewer.ip,
      });
    } else if (factType === "tuition") {
      const fact = await db.tuitionFact.delete({
        where: { id: factId },
        select: { programId: true },
      });
      await recordAuditEvent({
        actorId: reviewer.id,
        action: "catalog.fact_removed",
        entityType: "PROGRAM",
        entityId: fact.programId,
        metadata: { factType, factId },
        ip: reviewer.ip,
      });
    } else {
      const fact = await db.deadlineFact.delete({
        where: { id: factId },
        select: { programId: true, scholarshipId: true },
      });
      await recordAuditEvent({
        actorId: reviewer.id,
        action: "catalog.fact_removed",
        entityType: fact.programId ? "PROGRAM" : "SCHOLARSHIP",
        entityId: fact.programId ?? fact.scholarshipId ?? factId,
        metadata: { factType, factId },
        ip: reviewer.ip,
      });
    }

    return { ok: true, id: factId };
  } catch (error) {
    logError("catalog.review_operation_failed", error, {
      action: "remove_fact",
    });
    return { ok: false, message: "The fact could not be removed." };
  }
}

// ---------------------------------------------------------------------------
// Expiry sweep
// ---------------------------------------------------------------------------

export type SweepResult = {
  flagged: number;
  byType: Record<CatalogEntityTypeValue, number>;
  checkedAt: string;
};

/**
 * Moves verified records whose review window has passed to `NEEDS_REVIEW`.
 * They stay publicly visible with a warning banner rather than silently
 * presenting stale facts as current. Never deletes anything.
 */
export async function runExpirySweep(
  reviewerId: string | null = null,
): Promise<SweepResult> {
  const today = new Date(`${isoToday()}T00:00:00.000Z`);
  const staleWhere = {
    verificationStatus: "VERIFIED" as VerificationStatus,
    nextReviewAt: { lt: today },
  };

  const [universities, programs, scholarships] = await Promise.all([
    db.university.findMany({
      where: staleWhere,
      select: { id: true, nextReviewAt: true },
    }),
    db.program.findMany({
      where: staleWhere,
      select: { id: true, nextReviewAt: true },
    }),
    db.scholarship.findMany({
      where: staleWhere,
      select: { id: true, nextReviewAt: true },
    }),
  ]);

  const byType: Record<CatalogEntityTypeValue, number> = {
    UNIVERSITY: universities.length,
    PROGRAM: programs.length,
    SCHOLARSHIP: scholarships.length,
  };

  const targets = [
    ...universities.map((row) => ({ type: "UNIVERSITY" as const, ...row })),
    ...programs.map((row) => ({ type: "PROGRAM" as const, ...row })),
    ...scholarships.map((row) => ({ type: "SCHOLARSHIP" as const, ...row })),
  ];

  for (const target of targets) {
    const note = target.nextReviewAt
      ? `Review window ended on ${target.nextReviewAt.toISOString().slice(0, 10)}.`
      : "Review window ended.";

    await updateEntity(target.type, target.id, {
      verificationStatus: "NEEDS_REVIEW",
    });

    await db.catalogReview.create({
      data: {
        entityType: target.type,
        entityId: target.id,
        decision: "FLAG_STALE",
        fromStatus: "VERIFIED",
        toStatus: "NEEDS_REVIEW",
        note,
        reviewerId,
      },
    });

    await recordAuditEvent({
      actorId: reviewerId,
      action: "catalog.flag_stale",
      entityType: target.type,
      entityId: target.id,
      metadata: { note },
    });
  }

  return {
    flagged: targets.length,
    byType,
    checkedAt: new Date().toISOString(),
  };
}

/** Exposed for the reviewer screen copy. */
export const REVIEW_WINDOW_DAYS = REVIEW_INTERVAL_DAYS;
