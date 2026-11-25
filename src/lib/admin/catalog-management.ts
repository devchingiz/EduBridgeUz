import {
  nextReviewDate,
  type VerificationStatusValue,
} from "@/lib/catalog/constants";

/**
 * Shared rules for administrator-managed catalog records.
 *
 * Statuses are the source of truth: VERIFIED is published, UNVERIFIED is
 * unpublished, and ARCHIVED is withdrawn. There is deliberately no second
 * published flag that could drift out of sync with the review state.
 */

export type CatalogEntityType = "UNIVERSITY" | "SCHOLARSHIP";

export type CatalogStatusAction =
  "PUBLISH" | "UNPUBLISH" | "ARCHIVE" | "RESTORE";

export type CatalogReviewDecision =
  "APPROVE" | "REQUEST_CHANGES" | "ARCHIVE" | "RESTORE";

export type CatalogStatusUpdate = {
  status: VerificationStatusValue;
  lastVerifiedAt: Date | null;
  nextReviewAt: Date | null;
  decision: CatalogReviewDecision;
};

export type StatusTransitionResult =
  | { ok: true; update: CatalogStatusUpdate }
  | {
      ok: false;
      reason:
        "not_found" | "invalid_action" | "invalid_state" | "source_unverified";
    };

function isoDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function dateFromIso(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/**
 * Resolve a status action without touching the database. Publishing requires a
 * source verification date; restoring an archived record returns it to the
 * safe, unpublished state rather than silently republishing it.
 */
export function resolveCatalogStatusAction(
  action: CatalogStatusAction,
  currentStatus: VerificationStatusValue | null,
  sourceVerifiedAt: string | null,
): StatusTransitionResult {
  if (!currentStatus) return { ok: false, reason: "not_found" };

  if (action === "PUBLISH") {
    if (currentStatus === "ARCHIVED") {
      return { ok: false, reason: "invalid_state" };
    }
    if (!sourceVerifiedAt) return { ok: false, reason: "source_unverified" };
    const verifiedAt = dateFromIso(sourceVerifiedAt);
    return {
      ok: true,
      update: {
        status: "VERIFIED",
        lastVerifiedAt: verifiedAt,
        nextReviewAt: nextReviewDate(verifiedAt),
        decision: "APPROVE",
      },
    };
  }

  if (action === "UNPUBLISH") {
    if (currentStatus === "ARCHIVED") {
      return { ok: false, reason: "invalid_state" };
    }
    return {
      ok: true,
      update: {
        status: "UNVERIFIED",
        lastVerifiedAt: null,
        nextReviewAt: null,
        decision: "REQUEST_CHANGES",
      },
    };
  }

  if (action === "ARCHIVE") {
    if (currentStatus === "ARCHIVED") {
      return { ok: false, reason: "invalid_state" };
    }
    return {
      ok: true,
      update: {
        status: "ARCHIVED",
        lastVerifiedAt: null,
        nextReviewAt: null,
        decision: "ARCHIVE",
      },
    };
  }

  if (action === "RESTORE") {
    if (currentStatus !== "ARCHIVED") {
      return { ok: false, reason: "invalid_state" };
    }
    return {
      ok: true,
      update: {
        status: "UNVERIFIED",
        lastVerifiedAt: null,
        nextReviewAt: null,
        decision: "RESTORE",
      },
    };
  }

  return { ok: false, reason: "invalid_action" };
}

export type FeatureRuleResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "not_published" | "source_unverified" };

/** A featured card is a public promise, so it must be published and sourced. */
export function canFeatureCatalogRecord(input: {
  status: VerificationStatusValue;
  sourceVerifiedAt: string | null;
}): FeatureRuleResult {
  if (input.status !== "VERIFIED")
    return { ok: false, reason: "not_published" };
  if (!input.sourceVerifiedAt) {
    return { ok: false, reason: "source_unverified" };
  }
  return { ok: true };
}

export function normaliseCatalogLabel(value: string): string {
  return value
    .toLocaleLowerCase("en")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function slugFromCatalogName(value: string): string {
  return (
    normaliseCatalogLabel(value)
      .replace(/[^a-z0-9 ]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 100)
      .replace(/^-|-$/g, "") || "catalog-record"
  );
}

export function universityDuplicateKey(input: {
  name: string;
  city: string;
  countryCode: string;
}): string {
  return [
    normaliseCatalogLabel(input.name),
    normaliseCatalogLabel(input.city),
    input.countryCode.trim().toUpperCase(),
  ].join("|");
}

export function scholarshipDuplicateKey(input: {
  name: string;
  providerName: string;
}): string {
  return [
    normaliseCatalogLabel(input.name),
    normaliseCatalogLabel(input.providerName),
  ].join("|");
}

export type MissingInfoInput = {
  status: VerificationStatusValue;
  sourceVerifiedAt: string | null;
  nextReviewAt: string | null;
};

function baseMissingInfo(input: MissingInfoInput): string[] {
  const warnings: string[] = [];
  if (!input.sourceVerifiedAt) {
    warnings.push("The primary source has no verification date.");
  }
  if (input.status === "VERIFIED" && !input.nextReviewAt) {
    warnings.push("A published record needs a next review date.");
  }
  return warnings;
}

export function universityMissingInfo(
  input: MissingInfoInput & {
    websiteUrl: string | null;
    description: string | null;
    continent: string | null;
    institutionType: string | null;
    rankingDisplay: string | null;
    programCount: number;
  },
): string[] {
  const warnings = baseMissingInfo(input);
  if (!input.websiteUrl)
    warnings.push("No verified official website is stored.");
  if (!input.description) warnings.push("The description is empty.");
  if (!input.continent) warnings.push("The continent is missing.");
  if (!input.institutionType) warnings.push("The institution type is missing.");
  if (!input.rankingDisplay) warnings.push("No ranking is documented.");
  if (input.programCount === 0) {
    warnings.push("No programs are attached to this university.");
  }
  return warnings;
}

export function scholarshipMissingInfo(
  input: MissingInfoInput & {
    summary: string;
    providerUrl: string;
    hostCountryCode: string | null;
    degreeLevels: readonly string[];
    fields: readonly string[];
    nationalityScope: string;
    requirementCount: number;
    deadlineCount: number;
  },
): string[] {
  const warnings = baseMissingInfo(input);
  if (input.summary.trim().length < 20)
    warnings.push("The summary is too short.");
  if (!input.providerUrl) warnings.push("The provider URL is missing.");
  if (!input.hostCountryCode) warnings.push("The host country is missing.");
  if (input.degreeLevels.length === 0) {
    warnings.push("No eligible degree levels are documented.");
  }
  if (input.fields.length === 0)
    warnings.push("No eligible fields are documented.");
  if (input.nationalityScope === "UNKNOWN") {
    warnings.push("The nationality scope is not documented.");
  }
  if (input.requirementCount === 0)
    warnings.push("No requirements are recorded.");
  if (input.deadlineCount === 0) warnings.push("No deadline is recorded.");
  return warnings;
}

/** Routes that must be invalidated when catalog visibility or pinning changes. */
export function catalogRevalidationPaths(
  entityType: CatalogEntityType,
  slug?: string,
): string[] {
  const shared = [
    "/admin",
    "/dashboard",
    "/dashboard/review",
    "/api/health/ready",
  ];
  if (entityType === "UNIVERSITY") {
    return [
      ...shared,
      "/admin/universities",
      "/universities",
      "/dashboard/universities",
      ...(slug
        ? [`/universities/${slug}`, `/dashboard/universities/${slug}`]
        : []),
    ];
  }
  return [
    ...shared,
    "/admin/scholarships",
    "/scholarships",
    "/dashboard/scholarships",
    ...(slug
      ? [`/scholarships/${slug}`, `/dashboard/scholarships/${slug}`]
      : []),
  ];
}

export function isoDayString(value: Date | null): string | null {
  return value ? isoDay(value) : null;
}
