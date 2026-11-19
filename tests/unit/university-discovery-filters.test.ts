import { describe, expect, it } from "vitest";

import {
  discoverySearchHref,
  parseUniversityDiscoveryFilters,
} from "@/lib/catalog/discovery-filters";

describe("university discovery filter validation", () => {
  it("uses safe defaults for missing query parameters", () => {
    expect(parseUniversityDiscoveryFilters({})).toEqual({
      q: "",
      country: "all",
      continent: "all",
      institutionType: "all",
      degree: "all",
      maxTuition: undefined,
      currency: "EUR",
      scholarship: "all",
      intake: "all",
      sort: "name",
      page: 1,
    });
  });

  it("validates and normalizes supported filters", () => {
    expect(
      parseUniversityDiscoveryFilters({
        q: "  munich ",
        country: "DE",
        continent: "Europe",
        institutionType: "Public",
        degree: "MASTER",
        maxTuition: "12000.50",
        currency: "EUR",
        scholarship: "yes",
        intake: "WINTER",
        sort: "deadline",
        page: "3",
      }),
    ).toEqual({
      q: "munich",
      country: "DE",
      continent: "Europe",
      institutionType: "Public",
      degree: "MASTER",
      maxTuition: 12000.5,
      currency: "EUR",
      scholarship: "yes",
      intake: "WINTER",
      sort: "deadline",
      page: 3,
    });
  });

  it("discards invalid values without losing valid search terms", () => {
    expect(
      parseUniversityDiscoveryFilters({
        q: "TUM",
        country: "not-a-country",
        continent: "Mars",
        institutionType: "Unknown",
        degree: "MASTERS",
        maxTuition: "-20",
        currency: "XYZ",
        scholarship: "maybe",
        intake: "FALL",
        sort: "random",
        page: "99999",
      }),
    ).toEqual({
      q: "TUM",
      country: "all",
      continent: "all",
      institutionType: "all",
      degree: "all",
      maxTuition: undefined,
      currency: "EUR",
      scholarship: "all",
      intake: "all",
      sort: "name",
      page: 1,
    });
  });

  it("uses the first value for repeated parameters and bounds search text", () => {
    expect(
      parseUniversityDiscoveryFilters({
        country: ["DE", "NL"],
        q: "x".repeat(100),
      }),
    ).toMatchObject({ country: "DE", q: "x".repeat(80) });
  });
});

describe("university discovery URLs", () => {
  it("keeps active filters in pagination links and omits defaults", () => {
    const filters = parseUniversityDiscoveryFilters({
      q: "computer science",
      country: "NL",
      maxTuition: "15000",
      sort: "tuition",
    });
    const href = discoverySearchHref(filters, 2);

    expect(href).toContain("/dashboard/universities?");
    expect(href).toContain("q=computer+science");
    expect(href).toContain("country=NL");
    expect(href).toContain("maxTuition=15000");
    expect(href).toContain("sort=tuition");
    expect(href).toContain("page=2");
    expect(href).not.toContain("currency=EUR");
    expect(href).not.toContain("intake=all");
  });
});
