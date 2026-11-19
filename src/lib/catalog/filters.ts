import { DEGREE_LEVELS, STUDY_FIELDS, isStudyField } from "@/lib/data/fields";
import {
  CONTINENTS,
  FUNDING_TYPES,
  INSTITUTION_TYPES,
  type FundingTypeValue,
} from "@/lib/catalog/constants";

export const ALL_FILTER = "all";
export const CATALOG_PAGE_SIZE = 12;

export type SearchParamsInput = Record<string, string | string[] | undefined>;

export type UniversityFilters = {
  q: string;
  country: string;
  continent: string;
  institutionType: string;
  degree: string;
  field: string;
  page: number;
};

export type ScholarshipFilters = {
  q: string;
  hostCountry: string;
  funding: string;
  degree: string;
  field: string;
  nationality: string;
  page: number;
};

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function boundedQuery(value: string): string {
  return value.trim().slice(0, 80);
}

function positivePage(value: string): number {
  const page = Number.parseInt(value, 10);
  return Number.isFinite(page) && page > 0 ? Math.min(page, 1000) : 1;
}

function degreeFilter(value: string): string {
  return DEGREE_LEVELS.some((degree) => degree.value === value)
    ? value
    : ALL_FILTER;
}

function fieldFilter(value: string): string {
  return isStudyField(value) ? value : ALL_FILTER;
}

function countryFilter(value: string): string {
  return /^[A-Z]{2}$/.test(value) ? value : ALL_FILTER;
}

function oneOf(values: readonly string[], value: string): string {
  return values.includes(value) ? value : ALL_FILTER;
}

export function parseUniversityFilters(
  searchParams: SearchParamsInput,
): UniversityFilters {
  return {
    q: boundedQuery(first(searchParams.q)),
    country: countryFilter(first(searchParams.country)),
    continent: oneOf(CONTINENTS, first(searchParams.continent)),
    institutionType: oneOf(
      INSTITUTION_TYPES,
      first(searchParams.institution_type),
    ),
    degree: degreeFilter(first(searchParams.degree)),
    field: fieldFilter(first(searchParams.field)),
    page: positivePage(first(searchParams.page)),
  };
}

export function parseScholarshipFilters(
  searchParams: SearchParamsInput,
): ScholarshipFilters {
  const funding = first(searchParams.funding);
  return {
    q: boundedQuery(first(searchParams.q)),
    hostCountry: countryFilter(first(searchParams.host_country)),
    funding: (FUNDING_TYPES as readonly string[]).includes(funding)
      ? funding
      : ALL_FILTER,
    degree: degreeFilter(first(searchParams.degree)),
    field: fieldFilter(first(searchParams.field)),
    nationality: countryFilter(first(searchParams.nationality)),
    page: positivePage(first(searchParams.page)),
  };
}

export function hasActiveUniversityFilters(
  filters: UniversityFilters,
): boolean {
  return (
    filters.q.length > 0 ||
    filters.country !== ALL_FILTER ||
    filters.continent !== ALL_FILTER ||
    filters.institutionType !== ALL_FILTER ||
    filters.degree !== ALL_FILTER ||
    filters.field !== ALL_FILTER
  );
}

export function hasActiveScholarshipFilters(
  filters: ScholarshipFilters,
): boolean {
  return (
    filters.q.length > 0 ||
    filters.hostCountry !== ALL_FILTER ||
    filters.funding !== ALL_FILTER ||
    filters.degree !== ALL_FILTER ||
    filters.field !== ALL_FILTER ||
    filters.nationality !== ALL_FILTER
  );
}

function buildQuery(entries: [string, string | number | undefined][]): string {
  const params = new URLSearchParams();
  for (const [key, value] of entries) {
    if (value === undefined || value === "" || value === ALL_FILTER) continue;
    if (key === "page" && value === 1) continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function universitySearchHref(
  filters: UniversityFilters,
  page = filters.page,
): string {
  return `/universities${buildQuery([
    ["q", filters.q],
    ["country", filters.country],
    ["continent", filters.continent],
    ["institution_type", filters.institutionType],
    ["degree", filters.degree],
    ["field", filters.field],
    ["page", page],
  ])}`;
}

export function scholarshipSearchHref(
  filters: ScholarshipFilters,
  page = filters.page,
): string {
  return `/scholarships${buildQuery([
    ["q", filters.q],
    ["host_country", filters.hostCountry],
    ["funding", filters.funding],
    ["degree", filters.degree],
    ["field", filters.field],
    ["nationality", filters.nationality],
    ["page", page],
  ])}`;
}

export function isFundingType(value: string): value is FundingTypeValue {
  return (FUNDING_TYPES as readonly string[]).includes(value);
}

export { DEGREE_LEVELS, STUDY_FIELDS };
