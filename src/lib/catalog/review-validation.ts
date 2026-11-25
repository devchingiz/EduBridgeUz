import { z } from "zod";

import { COUNTRY_CODES } from "@/lib/data/countries";
import { DEGREE_LEVELS, STUDY_FIELDS } from "@/lib/data/fields";
import {
  ELIGIBILITY_SCOPES,
  FUNDING_TYPES,
  REQUIREMENT_KINDS,
} from "@/lib/catalog/constants";
import { httpUrlSchema, isoDateSchema } from "@/lib/catalog/provenance";

const degreeValues = DEGREE_LEVELS.map((degree) => degree.value);
const country = z.enum(COUNTRY_CODES, { error: "Choose a country." });

const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(2, `Enter the ${label}.`)
    .max(max, `Keep the ${label} under ${max} characters.`);

const slug = z
  .string()
  .trim()
  .min(2, "Enter a URL slug.")
  .max(120)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and single hyphens.",
  );

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (value === undefined || value === null ? "" : value),
    z
      .string()
      .trim()
      .max(max)
      .transform((value) => (value.length > 0 ? value : null)),
  );

const optionalInt = (max: number) =>
  z.preprocess(
    (value) =>
      value === "" || value === null || value === undefined
        ? null
        : Number(value),
    z
      .number()
      .int()
      .positive()
      .max(max, `Enter a number up to ${max}.`)
      .nullable(),
  );

const optionalDate = z.preprocess(
  (value) => (value === "" || value === null ? null : value),
  isoDateSchema.nullable(),
);

const optionalMonthDay = z.preprocess(
  (value) => (value === "" || value === null ? null : value),
  z
    .string()
    .regex(
      /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
      "Use a recurring month and day (MM-DD).",
    )
    .nullable(),
);

/**
 * Reviewer input contracts. Every mutation passes through these before it
 * reaches Prisma, so a malformed URL or an empty source title cannot be stored.
 */

export const sourceInputSchema = z.object({
  url: httpUrlSchema,
  publisher: z
    .string()
    .trim()
    .min(2, "Name the publishing organization.")
    .max(200),
  title: z.string().trim().min(2, "Give the source a title.").max(300),
  accessedAt: isoDateSchema,
  verifiedAt: optionalDate,
  notes: optionalText(600),
});

export type SourceInput = z.infer<typeof sourceInputSchema>;

export const universityFieldsSchema = z.object({
  name: requiredText("university name", 200),
  shortName: optionalText(80),
  city: requiredText("city", 120),
  countryCode: country,
  // An empty form value means the official website is unavailable. Never
  // guess a URL: store null and let the UI show an explicit unavailable state.
  websiteUrl: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? null : value,
    httpUrlSchema.nullable(),
  ),
  slug,
});

export type UniversityFieldsInput = z.infer<typeof universityFieldsSchema>;

export const programFieldsSchema = z.object({
  universityId: z.string().trim().min(1, "Choose a university."),
  name: requiredText("program name", 200),
  slug,
  degreeLevel: z.enum(degreeValues as [string, ...string[]], {
    error: "Choose a degree level.",
  }),
  field: z.enum(STUDY_FIELDS, { error: "Choose a field of study." }),
  language: optionalText(80),
  durationMonths: optionalInt(120),
  credits: optionalInt(600),
  startNote: optionalText(160),
});

export type ProgramFieldsInput = z.infer<typeof programFieldsSchema>;

export const scholarshipFieldsSchema = z.object({
  name: requiredText("scholarship name", 200),
  slug,
  providerName: requiredText("provider name", 200),
  providerUrl: httpUrlSchema,
  hostCountryCode: z.preprocess(
    (value) => (value === "" || value === null ? null : value),
    country.nullable(),
  ),
  fundingType: z.enum(FUNDING_TYPES),
  degreeLevels: z
    .array(z.enum(degreeValues as [string, ...string[]]))
    .min(1, "Choose at least one degree level."),
  nationalityScope: z.enum(ELIGIBILITY_SCOPES),
  eligibleNationalities: z.array(country),
  fieldScope: z.enum(ELIGIBILITY_SCOPES),
  fields: z.array(z.string().trim().min(2).max(120)),
  summary: z.string().trim().min(20, "Write a short summary.").max(1200),
});

export type ScholarshipFieldsInput = z.infer<typeof scholarshipFieldsSchema>;

export const requirementInputSchema = z.object({
  kind: z.enum(REQUIREMENT_KINDS),
  summary: z.string().trim().min(5, "Describe the requirement.").max(600),
});

export type RequirementInput = z.infer<typeof requirementInputSchema>;

export const tuitionInputSchema = z.object({
  amount: z
    .string()
    .trim()
    .min(1, "Enter the amount.")
    .regex(/^\d{1,9}(?:\.\d{1,2})?$/, "Use a number such as 6000 or 2771.50."),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Use an ISO 4217 currency code."),
  period: z.string().trim().min(2, "State the period.").max(80),
  applicantGroup: optionalText(160),
  note: optionalText(400),
});

export type TuitionInput = z.infer<typeof tuitionInputSchema>;

export const deadlineInputSchema = z
  .object({
    cycle: z.string().trim().min(2, "Name the cycle.").max(80),
    applicantGroup: optionalText(160),
    opensOn: optionalDate,
    deadlineOn: optionalDate,
    opensMonthDay: optionalMonthDay,
    deadlineMonthDay: optionalMonthDay,
    note: optionalText(400),
  })
  .superRefine((value, ctx) => {
    if (!value.deadlineOn && !value.deadlineMonthDay && !value.note) {
      ctx.addIssue({
        code: "custom",
        path: ["deadlineOn"],
        message: "A deadline needs a date or an explanatory note.",
      });
    }
    if (value.deadlineOn && value.deadlineMonthDay) {
      ctx.addIssue({
        code: "custom",
        path: ["deadlineMonthDay"],
        message: "Use either a calendar date or a recurring month-day.",
      });
    }
  });

export type DeadlineInput = z.infer<typeof deadlineInputSchema>;

export const DECISION_INPUTS = [
  "APPROVE",
  "REQUEST_CHANGES",
  "EXPIRE",
  "RESTORE",
  "ARCHIVE",
  "MARK_PARTIAL",
  "MARK_UNAVAILABLE",
] as const;

export const decisionInputSchema = z.object({
  decision: z.enum(DECISION_INPUTS),
  note: optionalText(600),
});

export type DecisionInput = z.infer<typeof decisionInputSchema>;

/**
 * The reviewer import format for facts. A staff member pastes this JSON on the
 * import screen; it is validated before any row is written. Facts inherit the
 * record's primary source unless `sourceUrl` names another citation already on
 * the record.
 */
export const importFactsSchema = z.object({
  requirements: z.array(requirementInputSchema).max(40).default([]),
  tuition: z.array(tuitionInputSchema).max(20).default([]),
  deadlines: z.array(deadlineInputSchema).max(20).default([]),
});

export type ImportFactsInput = z.infer<typeof importFactsSchema>;

export function parseImportFacts(raw: string):
  | {
      ok: true;
      facts: ImportFactsInput;
    }
  | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      ok: true,
      facts: { requirements: [], tuition: [], deadlines: [] },
    };
  }

  let json: unknown;
  try {
    json = JSON.parse(trimmed);
  } catch {
    return { ok: false, message: "The facts block is not valid JSON." };
  }

  const parsed = importFactsSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const path = first?.path.join(".") ?? "facts";
    return {
      ok: false,
      message: `Facts: ${path} — ${first?.message ?? "invalid value"}.`,
    };
  }

  return { ok: true, facts: parsed.data };
}

export function parseSlugList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function amountToMinor(amount: string): number {
  return Math.round(Number.parseFloat(amount) * 100);
}
