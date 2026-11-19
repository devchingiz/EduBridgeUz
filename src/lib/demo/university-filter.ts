import type { SampleUniversity } from "@/lib/demo/sample-universities";

export const ALL_FILTER = "all";

export type UniversityFilterState = {
  query: string;
  country: string;
  degree: string;
  field: string;
};

export const emptyUniversityFilters: UniversityFilterState = {
  query: "",
  country: ALL_FILTER,
  degree: ALL_FILTER,
  field: ALL_FILTER,
};

export function hasActiveUniversityFilters(
  filters: UniversityFilterState,
): boolean {
  return (
    filters.query.trim().length > 0 ||
    filters.country !== ALL_FILTER ||
    filters.degree !== ALL_FILTER ||
    filters.field !== ALL_FILTER
  );
}

/**
 * Pure filter function used by the landing-page discovery preview. It operates
 * on sample profiles only; the production catalog will use server-side,
 * database-backed filtering with the same input contract.
 */
export function filterSampleUniversities(
  universities: readonly SampleUniversity[],
  filters: UniversityFilterState,
): SampleUniversity[] {
  const query = filters.query.trim().toLowerCase();

  return universities.filter((university) => {
    if (
      filters.country !== ALL_FILTER &&
      university.country !== filters.country
    ) {
      return false;
    }

    if (
      filters.degree !== ALL_FILTER &&
      !university.degrees.some((degree) => degree === filters.degree)
    ) {
      return false;
    }

    if (
      filters.field !== ALL_FILTER &&
      !university.fields.some((field) => field === filters.field)
    ) {
      return false;
    }

    if (!query) {
      return true;
    }

    const haystack = [
      university.name,
      university.shortName,
      university.city,
      university.country,
      ...university.degrees,
      ...university.fields,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}
