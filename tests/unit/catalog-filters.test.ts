import { describe, expect, it } from "vitest";

import {
  ALL_FILTER,
  CATALOG_PAGE_SIZE,
  dashboardScholarshipSearchHref,
  hasActiveScholarshipFilters,
  hasActiveUniversityFilters,
  parseScholarshipFilters,
  parseUniversityFilters,
  scholarshipSearchHref,
  universitySearchHref,
} from "@/lib/catalog/filters";

describe("parseUniversityFilters", () => {
  it("uses safe defaults for empty parameters", () => {
    expect(parseUniversityFilters({})).toEqual({
      q: "",
      country: ALL_FILTER,
      continent: ALL_FILTER,
      institutionType: ALL_FILTER,
      degree: ALL_FILTER,
      field: ALL_FILTER,
      page: 1,
    });
  });

  it("trims and bounds the free-text query", () => {
    const filters = parseUniversityFilters({ q: `  ${"a".repeat(120)}  ` });
    expect(filters.q).toHaveLength(80);
  });

  it("keeps a valid ISO country code", () => {
    expect(parseUniversityFilters({ country: "DE" }).country).toBe("DE");
  });

  it("discards an invalid country code", () => {
    expect(parseUniversityFilters({ country: "Germany" }).country).toBe(
      ALL_FILTER,
    );
    expect(parseUniversityFilters({ country: "de" }).country).toBe(ALL_FILTER);
  });

  it("keeps only known continents and institution types", () => {
    expect(parseUniversityFilters({ continent: "Europe" }).continent).toBe(
      "Europe",
    );
    expect(parseUniversityFilters({ continent: "Mars" }).continent).toBe(
      ALL_FILTER,
    );
    expect(
      parseUniversityFilters({ institution_type: "Public" }).institutionType,
    ).toBe("Public");
    expect(
      parseUniversityFilters({ institution_type: "Unknown" }).institutionType,
    ).toBe(ALL_FILTER);
  });

  it("keeps only known degree levels and study fields", () => {
    expect(parseUniversityFilters({ degree: "MASTER" }).degree).toBe("MASTER");
    expect(parseUniversityFilters({ degree: "DOCTORATE" }).degree).toBe(
      ALL_FILTER,
    );
    expect(parseUniversityFilters({ field: "Computer Science" }).field).toBe(
      "Computer Science",
    );
    expect(
      parseUniversityFilters({ field: "Underwater Basket Weaving" }).field,
    ).toBe(ALL_FILTER);
  });

  it("clamps the page to a positive, bounded integer", () => {
    expect(parseUniversityFilters({ page: "3" }).page).toBe(3);
    expect(parseUniversityFilters({ page: "0" }).page).toBe(1);
    expect(parseUniversityFilters({ page: "-4" }).page).toBe(1);
    expect(parseUniversityFilters({ page: "abc" }).page).toBe(1);
    expect(parseUniversityFilters({ page: "99999" }).page).toBe(1000);
  });

  it("uses the first value when a parameter repeats", () => {
    expect(parseUniversityFilters({ country: ["FR", "DE"] }).country).toBe(
      "FR",
    );
  });
});

describe("parseScholarshipFilters", () => {
  it("reads the snake_case host country parameter", () => {
    expect(parseScholarshipFilters({ host_country: "SE" }).hostCountry).toBe(
      "SE",
    );
  });

  it("keeps only known funding types", () => {
    expect(parseScholarshipFilters({ funding: "FULLY_FUNDED" }).funding).toBe(
      "FULLY_FUNDED",
    );
    expect(parseScholarshipFilters({ funding: "FREE_MONEY" }).funding).toBe(
      ALL_FILTER,
    );
  });

  it("validates the nationality filter as a country code", () => {
    expect(parseScholarshipFilters({ nationality: "KE" }).nationality).toBe(
      "KE",
    );
    expect(parseScholarshipFilters({ nationality: "Kenya" }).nationality).toBe(
      ALL_FILTER,
    );
  });
});

describe("active filter detection", () => {
  it("is inactive when every value is the sentinel", () => {
    expect(hasActiveUniversityFilters(parseUniversityFilters({}))).toBe(false);
    expect(hasActiveScholarshipFilters(parseScholarshipFilters({}))).toBe(
      false,
    );
  });

  it("is active when any filter is set", () => {
    expect(
      hasActiveUniversityFilters(parseUniversityFilters({ q: "munich" })),
    ).toBe(true);
    expect(
      hasActiveScholarshipFilters(
        parseScholarshipFilters({ funding: "PARTIAL" }),
      ),
    ).toBe(true);
  });
});

describe("search hrefs", () => {
  it("omits inactive filters and the first page", () => {
    expect(universitySearchHref(parseUniversityFilters({}))).toBe(
      "/universities",
    );
    expect(scholarshipSearchHref(parseScholarshipFilters({}))).toBe(
      "/scholarships",
    );
  });

  it("encodes the active filters", () => {
    const href = universitySearchHref(
      parseUniversityFilters({ q: "computer science", country: "NL" }),
    );
    expect(href).toContain("/universities?");
    expect(href).toContain("q=computer+science");
    expect(href).toContain("country=NL");
    expect(href).not.toContain("page=");
  });

  it("keeps dashboard scholarship filters inside the dashboard", () => {
    const filters = parseScholarshipFilters({ funding: "FULLY_FUNDED" });
    expect(dashboardScholarshipSearchHref(filters)).toBe(
      "/dashboard/scholarships?funding=FULLY_FUNDED",
    );
    expect(dashboardScholarshipSearchHref(filters, 2)).toContain("page=2");
  });

  it("includes later pages", () => {
    expect(
      universitySearchHref(parseUniversityFilters({ q: "munich" }), 2),
    ).toContain("page=2");
  });

  it("uses the documented page size", () => {
    expect(CATALOG_PAGE_SIZE).toBe(12);
  });
});
