import { z } from "zod";

import { CONTINENTS, INSTITUTION_TYPES } from "@/lib/catalog/constants";
import { httpUrlSchema } from "@/lib/catalog/provenance";
import { sourceInputSchema } from "@/lib/catalog/review-validation";
import { COUNTRY_CODES } from "@/lib/data/countries";

/**
 * Administrator editor contracts. These extend the reviewer's minimal import
 * fields with every stored profile field, while reusing the strict source,
 * URL, and date rules already used by the provenance layer.
 */

const country = z.enum(COUNTRY_CODES, { error: "Choose a country." });

const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(2, `Enter the ${label}.`)
    .max(max, `Keep the ${label} under ${max} characters.`);

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (value === undefined || value === null ? "" : value),
    z
      .string()
      .trim()
      .max(max)
      .transform((value) => (value.length > 0 ? value : null)),
  );

const optionalUrl = z.preprocess(
  (value) =>
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "")
      ? null
      : value,
  httpUrlSchema.nullable(),
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

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(
    (value) =>
      value === undefined || value === "" || value === null ? null : value,
    z.enum(values).nullable(),
  );

const slug = z
  .string()
  .trim()
  .min(2, "Enter a URL slug.")
  .max(120)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and single hyphens.",
  );

const booleanFromForm = z.preprocess((value) => {
  if (value === true || value === "true" || value === "on" || value === "1") {
    return true;
  }
  return false;
}, z.boolean());

export const adminUniversityFieldsSchema = z.object({
  name: requiredText("university name", 200),
  slug,
  shortName: optionalText(80),
  city: requiredText("city", 120),
  countryCode: country,
  websiteUrl: optionalUrl,
  continent: optionalEnum(CONTINENTS),
  institutionType: optionalEnum(INSTITUTION_TYPES),
  logoUrl: optionalUrl,
  description: optionalText(5000),
  rankingOrganization: optionalText(120),
  rankingEdition: optionalText(60),
  rankingPosition: optionalInt(1000),
  rankingDisplay: optionalText(80),
  rankingTied: booleanFromForm,
  rankingIsRange: booleanFromForm,
  qsNid: optionalInt(100_000_000),
});

export type AdminUniversityFieldsInput = z.infer<
  typeof adminUniversityFieldsSchema
>;

export { sourceInputSchema };

export type AdminSourceInput = z.infer<typeof sourceInputSchema>;

/**
 * Repeated form controls and delimited CSV cells both arrive as a single raw
 * object. Normalise them into the arrays the shared reviewer schema expects so
 * administrator writes and reviewer writes use the exact same field rules.
 */
export function scholarshipFieldInput(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const list = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value.map((entry) => String(entry).trim()).filter(Boolean);
    }
    if (typeof value === "string") {
      return value
        .split("|")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
    return [];
  };
  return {
    ...raw,
    hostCountryCode:
      raw.hostCountryCode === undefined ||
      raw.hostCountryCode === null ||
      raw.hostCountryCode === ""
        ? null
        : raw.hostCountryCode,
    degreeLevels: list(raw.degreeLevels),
    eligibleNationalities: list(raw.eligibleNationalities),
    fields: list(raw.fields),
  };
}

/** Convert the first Zod issue for each field into a form-friendly record. */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "form";
    errors[key] ??= issue.message;
  }
  return errors;
}

export function formDataBoolean(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true" || value === "1";
}
