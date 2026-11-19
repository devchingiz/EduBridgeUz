import { describe, expect, it } from "vitest";

import {
  ALL_FILTER,
  emptyUniversityFilters,
  filterSampleUniversities,
  hasActiveUniversityFilters,
} from "@/lib/demo/university-filter";
import { sampleUniversities } from "@/lib/demo/sample-universities";

describe("filterSampleUniversities", () => {
  it("returns every sample profile when no filters are active", () => {
    expect(
      filterSampleUniversities(sampleUniversities, emptyUniversityFilters),
    ).toHaveLength(sampleUniversities.length);
  });

  it("matches a free-text query against name, city, and country", () => {
    const results = filterSampleUniversities(sampleUniversities, {
      ...emptyUniversityFilters,
      query: "toronto",
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe("University of Toronto");
  });

  it("matches a query against study fields", () => {
    const results = filterSampleUniversities(sampleUniversities, {
      ...emptyUniversityFilters,
      query: "medicine",
    });

    expect(results.map((university) => university.id)).toEqual([
      "national-university-of-singapore",
    ]);
  });

  it("combines country and degree filters", () => {
    const results = filterSampleUniversities(sampleUniversities, {
      ...emptyUniversityFilters,
      country: "Germany",
      degree: "Master",
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("technical-university-of-munich");
  });

  it("combines field and degree filters", () => {
    const results = filterSampleUniversities(sampleUniversities, {
      ...emptyUniversityFilters,
      degree: "PhD",
      field: "Business",
    });

    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every(
        (university) =>
          university.degrees.includes("PhD") &&
          university.fields.includes("Business"),
      ),
    ).toBe(true);
  });

  it("returns an empty list for a query with no matches", () => {
    const results = filterSampleUniversities(sampleUniversities, {
      ...emptyUniversityFilters,
      query: "university of atlantis",
    });

    expect(results).toEqual([]);
  });

  it("ignores surrounding whitespace in queries", () => {
    const results = filterSampleUniversities(sampleUniversities, {
      ...emptyUniversityFilters,
      query: "   KAIST   ",
    });

    expect(results[0]?.id).toBe("kaist");
  });

  it("treats the all sentinel as inactive", () => {
    const filters = {
      query: "",
      country: ALL_FILTER,
      degree: ALL_FILTER,
      field: ALL_FILTER,
    };

    expect(hasActiveUniversityFilters(filters)).toBe(false);
  });

  it("detects active filters", () => {
    expect(
      hasActiveUniversityFilters({
        ...emptyUniversityFilters,
        query: "KAIST",
      }),
    ).toBe(true);
    expect(
      hasActiveUniversityFilters({
        ...emptyUniversityFilters,
        country: "Canada",
      }),
    ).toBe(true);
  });
});
