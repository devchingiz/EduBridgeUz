import { z } from "zod";

import {
  CATALOG_ENTITY_TYPES,
  ELIGIBILITY_SCOPES,
  FIELD_VERIFICATION_STATUSES,
  FUNDING_TYPES,
  REQUIREMENT_KINDS,
  VERIFICATION_STATUSES,
} from "@/lib/catalog/constants";

/**
 * The provenance contract.
 *
 * A fact may only be presented as current when it carries a reviewer date and
 * a citation to an official source. These schemas are the single definition of
 * that rule: the reviewer service validates writes with them, the public query
 * layer validates reads with them, and the tests assert that a verified fact
 * without evidence is rejected.
 */

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use an ISO date (YYYY-MM-DD).");

export const monthDaySchema = z
  .string()
  .regex(
    /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
    "Use a recurring month and day (MM-DD).",
  );

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export const httpUrlSchema = z
  .string()
  .trim()
  .max(2048, "URL is too long.")
  .refine(isHttpUrl, "Enter a full http(s) URL.");

export const citationSchema = z.object({
  id: z.string().min(1),
  url: httpUrlSchema,
  publisher: z
    .string()
    .trim()
    .min(2, "Name the publishing organization.")
    .max(200),
  title: z.string().trim().min(2, "Give the source a title.").max(300),
  accessedAt: isoDateSchema,
  verifiedAt: isoDateSchema.nullable(),
});

export type CitationDto = z.infer<typeof citationSchema>;

export type ProvenanceLike = {
  status: (typeof VERIFICATION_STATUSES)[number];
  verifiedAt: string | null;
  nextReviewAt: string | null;
  source: Pick<CitationDto, "url" | "verifiedAt"> | null;
};

export type ProvenanceIssue = {
  path: (string | number)[];
  message: string;
};

/**
 * Returns every reason a provenance block cannot be trusted. Empty means the
 * block is internally consistent. Kept as a pure function so the reviewer
 * service can reject a write with a field-level message instead of throwing an
 * opaque schema error.
 */
export function provenanceIssues(value: ProvenanceLike): ProvenanceIssue[] {
  const issues: ProvenanceIssue[] = [];

  if (value.status === "VERIFIED") {
    if (!value.verifiedAt) {
      issues.push({
        path: ["verifiedAt"],
        message: "A verified fact needs the date a reviewer checked it.",
      });
    }
    if (!value.source) {
      issues.push({
        path: ["source"],
        message: "A verified fact needs a source citation.",
      });
    } else if (!value.source.verifiedAt) {
      issues.push({
        path: ["source", "verifiedAt"],
        message: "The citation needs its own verification date.",
      });
    }
  }

  if (value.source && !isHttpUrl(value.source.url)) {
    issues.push({
      path: ["source", "url"],
      message: "The source URL must be a full http(s) URL.",
    });
  }

  if (
    value.verifiedAt &&
    value.nextReviewAt &&
    value.nextReviewAt < value.verifiedAt
  ) {
    issues.push({
      path: ["nextReviewAt"],
      message: "The next review cannot be before the verification date.",
    });
  }

  return issues;
}

export const provenanceSchema = z
  .object({
    status: z.enum(VERIFICATION_STATUSES),
    verifiedAt: isoDateSchema.nullable(),
    nextReviewAt: isoDateSchema.nullable(),
    source: citationSchema.nullable(),
  })
  .superRefine((value, ctx) => {
    for (const issue of provenanceIssues(value)) {
      ctx.addIssue({
        code: "custom",
        message: issue.message,
        path: issue.path,
      });
    }
  });

export type ProvenanceDto = z.infer<typeof provenanceSchema>;

const withProvenance = <T extends z.ZodRawShape>(shape: T) =>
  z
    .object({ ...shape, provenance: provenanceSchema })
    .superRefine((value, ctx) => {
      const provenance = (value as { provenance: ProvenanceLike }).provenance;
      for (const issue of provenanceIssues(provenance)) {
        ctx.addIssue({
          code: "custom",
          message: issue.message,
          path: ["provenance", ...issue.path],
        });
      }
    });

export const requirementFactSchema = withProvenance({
  id: z.string().min(1),
  kind: z.enum(REQUIREMENT_KINDS),
  summary: z.string().trim().min(5, "Describe the requirement.").max(600),
});

export type RequirementFactDto = z.infer<typeof requirementFactSchema>;

export const tuitionFactSchema = withProvenance({
  id: z.string().min(1),
  amountMinor: z.number().int().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/, "Use an ISO 4217 currency code."),
  period: z.string().trim().min(2).max(80),
  applicantGroup: z.string().trim().max(160).nullable(),
  note: z.string().trim().max(400).nullable(),
});

export type TuitionFactDto = z.infer<typeof tuitionFactSchema>;

export const deadlineFactSchema = withProvenance({
  id: z.string().min(1),
  cycle: z.string().trim().min(2).max(80),
  applicantGroup: z.string().trim().max(160).nullable(),
  opensOn: isoDateSchema.nullable(),
  deadlineOn: isoDateSchema.nullable(),
  opensMonthDay: monthDaySchema.nullable(),
  deadlineMonthDay: monthDaySchema.nullable(),
  note: z.string().trim().max(400).nullable(),
}).superRefine((value, ctx) => {
  if (!value.deadlineOn && !value.deadlineMonthDay && !value.note) {
    ctx.addIssue({
      code: "custom",
      path: ["deadlineOn"],
      message: "A deadline fact needs a date or an explanatory note.",
    });
  }
  if (value.deadlineOn && value.deadlineMonthDay) {
    ctx.addIssue({
      code: "custom",
      path: ["deadlineMonthDay"],
      message: "Use either a calendar date or a recurring month-day, not both.",
    });
  }
});

export type DeadlineFactDto = z.infer<typeof deadlineFactSchema>;

export const universityProfileSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(2),
  shortName: z.string().nullable(),
  city: z.string().min(2),
  countryCode: z.string().length(2),
  websiteUrl: httpUrlSchema.nullable(),
  provenance: provenanceSchema,
});

export type UniversityProfileDto = z.infer<typeof universityProfileSchema>;

export const programProfileSchema = z.object({
  id: z.string().min(1),
  universityId: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(2),
  degreeLevel: z.enum(["BACHELOR", "MASTER", "PHD", "DIPLOMA", "CERTIFICATE"]),
  field: z.string().min(2),
  language: z.string().nullable(),
  durationMonths: z.number().int().positive().nullable(),
  credits: z.number().int().positive().nullable(),
  startMonths: z.array(z.number().int().min(1).max(12)),
  startNote: z.string().nullable(),
  provenance: provenanceSchema,
  requirements: z.array(requirementFactSchema),
  tuition: z.array(tuitionFactSchema),
  deadlines: z.array(deadlineFactSchema),
});

export type ProgramProfileDto = z.infer<typeof programProfileSchema>;

export const fieldFactSchema = z.object({
  id: z.string().min(1),
  fieldKey: z.string().min(1),
  label: z.string().min(1),
  value: z.string().nullable(),
  status: z.enum(FIELD_VERIFICATION_STATUSES),
  sourceUrl: httpUrlSchema.nullable(),
  sourceTitle: z.string().nullable(),
  verifiedAt: isoDateSchema.nullable(),
  academicYear: z.string().nullable(),
  intake: z.string().nullable(),
  currency: z.string().nullable(),
  unit: z.string().nullable(),
  note: z.string().nullable(),
});

export type FieldFactDto = z.infer<typeof fieldFactSchema>;

export const scholarshipProfileSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(2),
  providerName: z.string().min(2),
  providerUrl: httpUrlSchema,
  hostCountryCode: z.string().length(2).nullable(),
  fundingType: z.enum(FUNDING_TYPES),
  degreeLevels: z.array(
    z.enum(["BACHELOR", "MASTER", "PHD", "DIPLOMA", "CERTIFICATE"]),
  ),
  nationalityScope: z.enum(ELIGIBILITY_SCOPES),
  eligibleNationalities: z.array(z.string().length(2)),
  fieldScope: z.enum(ELIGIBILITY_SCOPES),
  fields: z.array(z.string().min(2)),
  summary: z.string().min(20),
  provenance: provenanceSchema,
  requirements: z.array(requirementFactSchema),
  deadlines: z.array(deadlineFactSchema),
});

export type ScholarshipProfileDto = z.infer<typeof scholarshipProfileSchema>;

/**
 * Serialised provenance response used by tests and by any future read API.
 * It is deliberately stricter than the page view: a response that claims
 * `VERIFIED` must include at least one source.
 */
export const provenanceResponseSchema = z
  .object({
    entity: z.object({
      id: z.string().min(1),
      type: z.enum(CATALOG_ENTITY_TYPES),
      slug: z.string().min(1),
      name: z.string().min(2),
    }),
    status: z.enum(VERIFICATION_STATUSES),
    lastVerifiedAt: isoDateSchema.nullable(),
    nextReviewAt: isoDateSchema.nullable(),
    sources: z.array(citationSchema),
    facts: z.array(
      z.object({
        key: z.string().min(1),
        label: z.string().min(1),
        value: z.string(),
        provenance: provenanceSchema,
      }),
    ),
  })
  .superRefine((value, ctx) => {
    if (value.status === "VERIFIED" && value.sources.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["sources"],
        message: "A verified record must expose at least one source.",
      });
    }
  });

export type ProvenanceResponseDto = z.infer<typeof provenanceResponseSchema>;
