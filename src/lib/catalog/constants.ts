/**
 * Catalog vocabulary shared by the public catalog, the reviewer workflow, and
 * the provenance tests. Values mirror the Prisma enums; labels are UI-only.
 */

export const VERIFICATION_STATUSES = [
  "VERIFIED",
  "PARTIALLY_VERIFIED",
  "INFORMATION_UNAVAILABLE",
  "NEEDS_REVIEW",
  "UNVERIFIED",
  "EXPIRED",
  "ARCHIVED",
] as const;

export type VerificationStatusValue = (typeof VERIFICATION_STATUSES)[number];

export const FIELD_VERIFICATION_STATUSES = [
  "VERIFIED",
  "PARTIALLY_VERIFIED",
  "NOT_VERIFIED",
  "INFORMATION_UNAVAILABLE",
] as const;

export type FieldVerificationStatusValue =
  (typeof FIELD_VERIFICATION_STATUSES)[number];

/** QS-derived continent and institution-type values used by catalog filters. */
export const CONTINENTS = [
  "Africa",
  "Asia",
  "Europe",
  "North America",
  "Oceania",
  "South America",
] as const;

export const INSTITUTION_TYPES = [
  "Public",
  "Private not for Profit",
  "Private for Profit",
] as const;

/** Records a public visitor may see. Stale records stay visible but flagged. */
export const PUBLIC_VISIBLE_STATUSES = [
  "VERIFIED",
  "PARTIALLY_VERIFIED",
  "NEEDS_REVIEW",
] as const;

/** Only this status is presented as current and authoritative. */
export const PUBLISHED_STATUS = "VERIFIED" as const;

export const VERIFICATION_LABELS: Record<VerificationStatusValue, string> = {
  VERIFIED: "Verified",
  PARTIALLY_VERIFIED: "Partially verified",
  INFORMATION_UNAVAILABLE: "Information unavailable",
  NEEDS_REVIEW: "Needs review",
  UNVERIFIED: "Not verified",
  EXPIRED: "Expired",
  ARCHIVED: "Archived",
};

export const FIELD_VERIFICATION_LABELS: Record<
  FieldVerificationStatusValue,
  string
> = {
  VERIFIED: "Verified",
  PARTIALLY_VERIFIED: "Partially verified",
  NOT_VERIFIED: "Not verified",
  INFORMATION_UNAVAILABLE: "Information unavailable",
};

export const VERIFICATION_DESCRIPTIONS: Record<
  VerificationStatusValue,
  string
> = {
  VERIFIED: "Checked against an official source on the date shown.",
  PARTIALLY_VERIFIED:
    "Sourced from a recognised third-party index such as QS; not checked against the institution's own current page.",
  INFORMATION_UNAVAILABLE:
    "No trustworthy source value is available; the profile says so explicitly.",
  NEEDS_REVIEW:
    "Previously checked, but the review window has passed or something changed. Treat it as a lead, not a current fact.",
  UNVERIFIED: "Collected but not yet checked by a reviewer.",
  EXPIRED: "Past its review window and no longer presented as current.",
  ARCHIVED: "Withdrawn from the public catalog.",
};

/** How long a human verification stays current before re-review. */
export const REVIEW_INTERVAL_DAYS = 180;

export function nextReviewDate(from: Date): Date {
  const next = new Date(from);
  next.setUTCDate(next.getUTCDate() + REVIEW_INTERVAL_DAYS);
  return next;
}

export const FUNDING_TYPES = [
  "FULLY_FUNDED",
  "PARTIAL",
  "TUITION_WAIVER",
  "STIPEND",
  "OTHER",
] as const;

export type FundingTypeValue = (typeof FUNDING_TYPES)[number];

export const FUNDING_LABELS: Record<FundingTypeValue, string> = {
  FULLY_FUNDED: "Fully funded",
  PARTIAL: "Partial funding",
  TUITION_WAIVER: "Tuition waiver",
  STIPEND: "Stipend",
  OTHER: "Other",
};

export const ELIGIBILITY_SCOPES = ["ALL", "LISTED", "UNKNOWN"] as const;
export type EligibilityScopeValue = (typeof ELIGIBILITY_SCOPES)[number];

export const ELIGIBILITY_LABELS: Record<EligibilityScopeValue, string> = {
  ALL: "Open to all nationalities",
  LISTED: "Specific nationalities",
  UNKNOWN: "Not documented",
};

export const REQUIREMENT_KINDS = [
  "ACADEMIC",
  "ENGLISH_LANGUAGE",
  "DOCUMENT",
  "PORTFOLIO",
  "WORK_EXPERIENCE",
  "OTHER",
] as const;

export type RequirementKindValue = (typeof REQUIREMENT_KINDS)[number];

export const REQUIREMENT_LABELS: Record<RequirementKindValue, string> = {
  ACADEMIC: "Academic",
  ENGLISH_LANGUAGE: "English language",
  DOCUMENT: "Document",
  PORTFOLIO: "Portfolio",
  WORK_EXPERIENCE: "Work experience",
  OTHER: "Other",
};

export const CATALOG_ENTITY_TYPES = [
  "UNIVERSITY",
  "PROGRAM",
  "SCHOLARSHIP",
] as const;

export type CatalogEntityTypeValue = (typeof CATALOG_ENTITY_TYPES)[number];

export const CATALOG_ENTITY_LABELS: Record<CatalogEntityTypeValue, string> = {
  UNIVERSITY: "University",
  PROGRAM: "Program",
  SCHOLARSHIP: "Scholarship",
};

export const REVIEW_DECISIONS = [
  "IMPORT",
  "EDIT",
  "APPROVE",
  "REQUEST_CHANGES",
  "EXPIRE",
  "RESTORE",
  "ARCHIVE",
  "MARK_PARTIAL",
  "MARK_UNAVAILABLE",
  "FLAG_STALE",
] as const;

export type ReviewDecisionValue = (typeof REVIEW_DECISIONS)[number];

export const REVIEW_DECISION_LABELS: Record<ReviewDecisionValue, string> = {
  IMPORT: "Imported",
  EDIT: "Edited",
  APPROVE: "Approved",
  REQUEST_CHANGES: "Changes requested",
  EXPIRE: "Expired",
  RESTORE: "Restored",
  ARCHIVE: "Archived",
  MARK_PARTIAL: "Marked partially verified",
  MARK_UNAVAILABLE: "Marked information unavailable",
  FLAG_STALE: "Flagged stale",
};

/** Public URL path segments for each catalog entity type. */
export const ENTITY_PATHS: Record<CatalogEntityTypeValue, string> = {
  UNIVERSITY: "universities",
  PROGRAM: "programs",
  SCHOLARSHIP: "scholarships",
};
