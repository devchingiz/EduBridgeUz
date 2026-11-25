"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";

import { requireRole } from "@/lib/auth/dal";
import { getRequestContext, assertSameOrigin } from "@/lib/http/request";
import { errorState, successState, type FormState } from "@/lib/actions/state";
import {
  createProgram,
  createScholarship,
  createUniversity,
  recordDecision,
  removeFact,
  runExpirySweep,
  updateRecord,
  addDeadline,
  addRequirement,
  addTuition,
  type Reviewer,
} from "@/lib/catalog/review-service";
import {
  DECISION_INPUTS,
  amountToMinor,
  deadlineInputSchema,
  decisionInputSchema,
  parseImportFacts,
  programFieldsSchema,
  requirementInputSchema,
  scholarshipFieldsSchema,
  sourceInputSchema,
  tuitionInputSchema,
  universityFieldsSchema,
} from "@/lib/catalog/review-validation";
import type { CatalogEntityType } from "@prisma/client";

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function checked(formData: FormData, key: string): boolean {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function list(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string");
}

function splitList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

function sourceFrom(formData: FormData) {
  return sourceInputSchema.safeParse({
    url: text(formData, "sourceUrl"),
    publisher: text(formData, "publisher"),
    title: text(formData, "sourceTitle"),
    accessedAt: text(formData, "accessedAt"),
    verifiedAt: text(formData, "verifiedAt"),
    notes: text(formData, "sourceNotes"),
  });
}

const SOURCE_KEY_MAP: Record<string, string> = {
  url: "sourceUrl",
  title: "sourceTitle",
  publisher: "publisher",
  accessedAt: "accessedAt",
  verifiedAt: "verifiedAt",
  notes: "sourceNotes",
};

function sourceErrors(error: z.ZodError): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [key, message] of Object.entries(fieldErrors(error))) {
    mapped[SOURCE_KEY_MAP[key] ?? key] = message;
  }
  return mapped;
}

async function reviewerContext(): Promise<Reviewer> {
  const session = await requireRole(["REVIEWER", "ADMIN", "SUPER_ADMIN"]);
  const context = await getRequestContext();
  return { id: session.user.id, ip: context.ip };
}

function refreshCatalog(entityType: CatalogEntityType) {
  revalidatePath("/dashboard/review");
  if (entityType === "UNIVERSITY") {
    revalidatePath("/universities");
  } else if (entityType === "PROGRAM") {
    revalidatePath("/universities");
  } else {
    revalidatePath("/scholarships");
  }
}

const ENTITY_TYPES = ["UNIVERSITY", "PROGRAM", "SCHOLARSHIP"] as const;

function entityTypeFrom(formData: FormData): CatalogEntityType | null {
  const value = text(formData, "entityType");
  return (ENTITY_TYPES as readonly string[]).includes(value)
    ? (value as CatalogEntityType)
    : null;
}

function reviewPath(entityType: CatalogEntityType, id: string): string {
  return `/dashboard/review/${entityType.toLowerCase()}/${id}`;
}

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

export async function importUniversityAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const reviewer = await reviewerContext();

  const source = sourceFrom(formData);
  const fields = universityFieldsSchema.safeParse({
    name: text(formData, "name"),
    shortName: text(formData, "shortName"),
    city: text(formData, "city"),
    countryCode: text(formData, "countryCode"),
    websiteUrl: text(formData, "websiteUrl"),
    slug: text(formData, "slug"),
  });

  const errors = {
    ...(source.success ? {} : sourceErrors(source.error)),
    ...(fields.success ? {} : fieldErrors(fields.error)),
  };
  if (Object.keys(errors).length > 0) {
    return errorState("Check the highlighted fields and try again.", errors);
  }
  if (!source.success || !fields.success) {
    return errorState("Check the highlighted fields and try again.");
  }

  const publish = checked(formData, "publish");
  if (publish && !source.data.verifiedAt) {
    return errorState("Enter the date you checked the official source.", {
      verifiedAt: "A verification date is required to publish.",
    });
  }

  const result = await createUniversity(
    fields.data,
    source.data,
    publish,
    reviewer,
  );
  if (!result.ok) {
    return errorState(result.message, result.fieldErrors);
  }

  refreshCatalog("UNIVERSITY");
  redirect(reviewPath("UNIVERSITY", result.id));
}

export async function importProgramAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const reviewer = await reviewerContext();

  const source = sourceFrom(formData);
  const fields = programFieldsSchema.safeParse({
    universityId: text(formData, "universityId"),
    name: text(formData, "name"),
    slug: text(formData, "slug"),
    degreeLevel: text(formData, "degreeLevel"),
    field: text(formData, "field"),
    language: text(formData, "language"),
    durationMonths: text(formData, "durationMonths"),
    credits: text(formData, "credits"),
    startNote: text(formData, "startNote"),
  });
  const facts = parseImportFacts(text(formData, "facts"));

  const errors = {
    ...(source.success ? {} : sourceErrors(source.error)),
    ...(fields.success ? {} : fieldErrors(fields.error)),
    ...(facts.ok ? {} : { facts: facts.message }),
  };
  if (Object.keys(errors).length > 0) {
    return errorState("Check the highlighted fields and try again.", errors);
  }
  if (!source.success || !fields.success || !facts.ok) {
    return errorState("Check the highlighted fields and try again.");
  }

  const publish = checked(formData, "publish");
  if (publish && !source.data.verifiedAt) {
    return errorState("Enter the date you checked the official source.", {
      verifiedAt: "A verification date is required to publish.",
    });
  }

  const result = await createProgram(
    fields.data,
    source.data,
    facts.facts,
    publish,
    reviewer,
  );
  if (!result.ok) {
    return errorState(result.message, result.fieldErrors);
  }

  refreshCatalog("PROGRAM");
  redirect(reviewPath("PROGRAM", result.id));
}

export async function importScholarshipAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const reviewer = await reviewerContext();

  const source = sourceFrom(formData);
  const fields = scholarshipFieldsSchema.safeParse({
    name: text(formData, "name"),
    slug: text(formData, "slug"),
    providerName: text(formData, "providerName"),
    providerUrl: text(formData, "providerUrl"),
    hostCountryCode: text(formData, "hostCountryCode"),
    fundingType: text(formData, "fundingType"),
    degreeLevels: list(formData, "degreeLevels"),
    nationalityScope: text(formData, "nationalityScope"),
    eligibleNationalities: splitList(text(formData, "eligibleNationalities")),
    fieldScope: text(formData, "fieldScope"),
    fields: splitList(text(formData, "fields")),
    summary: text(formData, "summary"),
  });
  const facts = parseImportFacts(text(formData, "facts"));

  const errors = {
    ...(source.success ? {} : sourceErrors(source.error)),
    ...(fields.success ? {} : fieldErrors(fields.error)),
    ...(facts.ok ? {} : { facts: facts.message }),
  };
  if (Object.keys(errors).length > 0) {
    return errorState("Check the highlighted fields and try again.", errors);
  }
  if (!source.success || !fields.success || !facts.ok) {
    return errorState("Check the highlighted fields and try again.");
  }

  const publish = checked(formData, "publish");
  if (publish && !source.data.verifiedAt) {
    return errorState("Enter the date you checked the official source.", {
      verifiedAt: "A verification date is required to publish.",
    });
  }

  const result = await createScholarship(
    fields.data,
    source.data,
    facts.facts,
    publish,
    reviewer,
  );
  if (!result.ok) {
    return errorState(result.message, result.fieldErrors);
  }

  refreshCatalog("SCHOLARSHIP");
  redirect(reviewPath("SCHOLARSHIP", result.id));
}

// ---------------------------------------------------------------------------
// Edits and decisions
// ---------------------------------------------------------------------------

export async function updateRecordAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const reviewer = await reviewerContext();

  const entityType = entityTypeFrom(formData);
  const id = text(formData, "id");
  if (!entityType || !id) return errorState("That record could not be found.");

  const source = sourceFrom(formData);
  if (!source.success) {
    return errorState(
      "Check the source details and try again.",
      sourceErrors(source.error),
    );
  }

  const publish = checked(formData, "publish");
  if (publish && !source.data.verifiedAt) {
    return errorState("Enter the date you checked the official source.", {
      verifiedAt: "A verification date is required to publish.",
    });
  }

  let result;
  if (entityType === "UNIVERSITY") {
    const fields = universityFieldsSchema.safeParse({
      name: text(formData, "name"),
      shortName: text(formData, "shortName"),
      city: text(formData, "city"),
      countryCode: text(formData, "countryCode"),
      websiteUrl: text(formData, "websiteUrl"),
      slug: text(formData, "slug"),
    });
    if (!fields.success) {
      return errorState(
        "Check the highlighted fields and try again.",
        fieldErrors(fields.error),
      );
    }
    result = await updateRecord({
      entityType,
      id,
      source: source.data,
      publish,
      reviewer,
      university: fields.data,
    });
  } else if (entityType === "PROGRAM") {
    const fields = programFieldsSchema.safeParse({
      universityId: text(formData, "universityId"),
      name: text(formData, "name"),
      slug: text(formData, "slug"),
      degreeLevel: text(formData, "degreeLevel"),
      field: text(formData, "field"),
      language: text(formData, "language"),
      durationMonths: text(formData, "durationMonths"),
      credits: text(formData, "credits"),
      startNote: text(formData, "startNote"),
    });
    if (!fields.success) {
      return errorState(
        "Check the highlighted fields and try again.",
        fieldErrors(fields.error),
      );
    }
    result = await updateRecord({
      entityType,
      id,
      source: source.data,
      publish,
      reviewer,
      program: fields.data,
    });
  } else {
    const fields = scholarshipFieldsSchema.safeParse({
      name: text(formData, "name"),
      slug: text(formData, "slug"),
      providerName: text(formData, "providerName"),
      providerUrl: text(formData, "providerUrl"),
      hostCountryCode: text(formData, "hostCountryCode"),
      fundingType: text(formData, "fundingType"),
      degreeLevels: list(formData, "degreeLevels"),
      nationalityScope: text(formData, "nationalityScope"),
      eligibleNationalities: splitList(text(formData, "eligibleNationalities")),
      fieldScope: text(formData, "fieldScope"),
      fields: splitList(text(formData, "fields")),
      summary: text(formData, "summary"),
    });
    if (!fields.success) {
      return errorState(
        "Check the highlighted fields and try again.",
        fieldErrors(fields.error),
      );
    }
    result = await updateRecord({
      entityType,
      id,
      source: source.data,
      publish,
      reviewer,
      scholarship: fields.data,
    });
  }

  if (!result.ok) return errorState(result.message, result.fieldErrors);

  refreshCatalog(entityType);
  revalidatePath(reviewPath(entityType, id));
  return successState(
    publish
      ? "Record saved and marked as verified."
      : "Record saved. It stays in the review queue until re-verified.",
  );
}

export async function decisionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const reviewer = await reviewerContext();

  const entityType = entityTypeFrom(formData);
  const id = text(formData, "id");
  if (!entityType || !id) return errorState("That record could not be found.");

  const parsed = decisionInputSchema.safeParse({
    decision: text(formData, "decision"),
    note: text(formData, "note"),
  });
  if (!parsed.success) {
    return errorState(
      "Choose a decision and add a note where required.",
      fieldErrors(parsed.error),
    );
  }
  if (!(DECISION_INPUTS as readonly string[]).includes(parsed.data.decision)) {
    return errorState("That decision is not supported.");
  }
  if (parsed.data.decision === "REQUEST_CHANGES" && !parsed.data.note) {
    return errorState(
      "Explain what needs to change before requesting changes.",
      {
        note: "Add a note for the next reviewer.",
      },
    );
  }

  const result = await recordDecision({
    entityType,
    id,
    decision: parsed.data.decision,
    note: parsed.data.note,
    reviewer,
  });
  if (!result.ok) return errorState(result.message);

  refreshCatalog(entityType);
  revalidatePath(reviewPath(entityType, id));
  return successState("Decision recorded.");
}

// ---------------------------------------------------------------------------
// Facts
// ---------------------------------------------------------------------------

export async function addRequirementAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const reviewer = await reviewerContext();
  const entityType = entityTypeFrom(formData);
  const id = text(formData, "id");
  if (!entityType || entityType === "UNIVERSITY" || !id) {
    return errorState("That record could not be found.");
  }

  const parsed = requirementInputSchema.safeParse({
    kind: text(formData, "kind"),
    summary: text(formData, "summary"),
  });
  if (!parsed.success) {
    return errorState(
      "Check the requirement and try again.",
      fieldErrors(parsed.error),
    );
  }

  const result = await addRequirement(entityType, id, parsed.data, reviewer);
  if (!result.ok) return errorState(result.message);

  refreshCatalog(entityType);
  revalidatePath(reviewPath(entityType, id));
  return successState("Requirement added with the record's primary source.");
}

export async function addTuitionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const reviewer = await reviewerContext();
  const id = text(formData, "id");
  if (!id) return errorState("That program could not be found.");

  const parsed = tuitionInputSchema.safeParse({
    amount: text(formData, "amount"),
    currency: text(formData, "currency"),
    period: text(formData, "period"),
    applicantGroup: text(formData, "applicantGroup"),
    note: text(formData, "note"),
  });
  if (!parsed.success) {
    return errorState(
      "Check the tuition fact and try again.",
      fieldErrors(parsed.error),
    );
  }

  const result = await addTuition(id, parsed.data, reviewer);
  if (!result.ok) return errorState(result.message);

  refreshCatalog("PROGRAM");
  revalidatePath(reviewPath("PROGRAM", id));
  return successState(
    `Tuition fact added (${amountToMinor(parsed.data.amount) / 100} ${parsed.data.currency}).`,
  );
}

export async function addDeadlineAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await assertSameOrigin();
  const reviewer = await reviewerContext();
  const entityType = entityTypeFrom(formData);
  const id = text(formData, "id");
  if (!entityType || entityType === "UNIVERSITY" || !id) {
    return errorState("That record could not be found.");
  }

  const parsed = deadlineInputSchema.safeParse({
    cycle: text(formData, "cycle"),
    applicantGroup: text(formData, "applicantGroup"),
    opensOn: text(formData, "opensOn"),
    deadlineOn: text(formData, "deadlineOn"),
    opensMonthDay: text(formData, "opensMonthDay"),
    deadlineMonthDay: text(formData, "deadlineMonthDay"),
    note: text(formData, "note"),
  });
  if (!parsed.success) {
    return errorState(
      "Check the deadline and try again.",
      fieldErrors(parsed.error),
    );
  }

  const result = await addDeadline(entityType, id, parsed.data, reviewer);
  if (!result.ok) return errorState(result.message);

  refreshCatalog(entityType);
  revalidatePath(reviewPath(entityType, id));
  return successState("Deadline added with the record's primary source.");
}

export async function removeFactAction(formData: FormData): Promise<void> {
  await assertSameOrigin();
  const reviewer = await reviewerContext();

  const factType = text(formData, "factType");
  const factId = text(formData, "factId");
  const redirectTo = text(formData, "redirectTo");
  if (!["requirement", "tuition", "deadline"].includes(factType) || !factId) {
    redirect("/dashboard/review");
  }

  await removeFact(
    factType as "requirement" | "tuition" | "deadline",
    factId,
    reviewer,
  );

  revalidatePath("/dashboard/review");
  revalidatePath("/universities");
  revalidatePath("/scholarships");
  redirect(
    redirectTo.startsWith("/dashboard/review/")
      ? redirectTo
      : "/dashboard/review",
  );
}

export async function runSweepAction(): Promise<void> {
  await assertSameOrigin();
  const session = await requireRole(["REVIEWER", "ADMIN", "SUPER_ADMIN"]);
  await runExpirySweep(session.user.id);
  revalidatePath("/dashboard/review");
  revalidatePath("/universities");
  revalidatePath("/scholarships");
  redirect("/dashboard/review?swept=1");
}
