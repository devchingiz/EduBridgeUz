import { DegreeLevel, IntakeTerm } from "@prisma/client";
import { z } from "zod";

import { CONTINENTS, INSTITUTION_TYPES } from "@/lib/catalog/constants";
import { COUNTRY_CODES } from "@/lib/data/countries";

export const DISCOVERY_PAGE_SIZE = 12;

const currencies = ["EUR", "USD", "GBP", "SEK", "CAD", "AUD"] as const;
const sortValues = ["name", "tuition", "deadline"] as const;

const firstValue = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

const optionalAmount = z
  .string()
  .trim()
  .transform((value) => (value ? Number(value) : undefined))
  .pipe(z.number().finite().min(0).max(100_000_000).optional());

export const universityDiscoveryFilterSchema = z.object({
  q: z.string().trim().max(80).catch(""),
  country: z.enum(COUNTRY_CODES).or(z.literal("all")).catch("all"),
  continent: z.enum(CONTINENTS).or(z.literal("all")).catch("all"),
  institutionType: z.enum(INSTITUTION_TYPES).or(z.literal("all")).catch("all"),
  degree: z.enum(DegreeLevel).or(z.literal("all")).catch("all"),
  maxTuition: optionalAmount.catch(undefined),
  currency: z.enum(currencies).catch("EUR"),
  scholarship: z.enum(["all", "yes", "no"]).catch("all"),
  intake: z.enum(IntakeTerm).or(z.literal("all")).catch("all"),
  sort: z.enum(sortValues).catch("name"),
  page: z.coerce.number().int().min(1).max(1000).catch(1),
});

export type UniversityDiscoveryFilters = z.infer<
  typeof universityDiscoveryFilterSchema
>;
export type UniversityDiscoverySearchParams = Record<
  string,
  string | string[] | undefined
>;

export function parseUniversityDiscoveryFilters(
  params: UniversityDiscoverySearchParams,
): UniversityDiscoveryFilters {
  return universityDiscoveryFilterSchema.parse({
    q: firstValue(params.q).trim().slice(0, 80),
    country: firstValue(params.country) || "all",
    continent: firstValue(params.continent) || "all",
    institutionType: firstValue(params.institutionType) || "all",
    degree: firstValue(params.degree) || "all",
    maxTuition: firstValue(params.maxTuition),
    currency: firstValue(params.currency) || "EUR",
    scholarship: firstValue(params.scholarship) || "all",
    intake: firstValue(params.intake) || "all",
    sort: firstValue(params.sort) || "name",
    page: firstValue(params.page) || "1",
  });
}

export function discoverySearchHref(
  filters: UniversityDiscoveryFilters,
  page = filters.page,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, page })) {
    if (
      value === undefined ||
      value === "" ||
      value === "all" ||
      (key === "page" && value === 1) ||
      (key === "currency" && value === "EUR") ||
      (key === "sort" && value === "name")
    ) {
      continue;
    }
    params.set(key, String(value));
  }
  const query = params.toString();
  return `/dashboard/universities${query ? `?${query}` : ""}`;
}
