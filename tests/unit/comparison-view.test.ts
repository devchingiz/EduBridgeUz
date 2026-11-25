import { describe, expect, it } from "vitest";

import {
  buildComparisonGroups,
  countDifferentRows,
  countSourcedFields,
  type ComparisonViewFact,
  type ComparisonViewUniversity,
} from "@/lib/catalog/comparison-view";
import { formatMoney } from "@/lib/catalog/format";

function fact(overrides: Partial<ComparisonViewFact> = {}): ComparisonViewFact {
  return {
    fieldKey: "acceptance_rate",
    label: "Acceptance rate",
    value: "20%",
    status: "PARTIALLY_VERIFIED",
    sourceUrl: "https://example.edu/facts",
    sourceTitle: "Admissions facts",
    verifiedAt: "2026-10-01",
    academicYear: "2027",
    intake: "Autumn",
    currency: null,
    unit: "%",
    note: null,
    ...overrides,
  };
}

function university(
  id: string,
  overrides: Partial<ComparisonViewUniversity> = {},
): ComparisonViewUniversity {
  return {
    id,
    slug: id,
    name: `University ${id}`,
    city: "Boston",
    countryCode: "US",
    websiteUrl: `https://${id}.edu`,
    continent: "North America",
    institutionType: "Public",
    logoUrl: null,
    rankingDisplay: "101–150",
    status: "PARTIALLY_VERIFIED",
    programCount: 12,
    lowestAnnualTuition: {
      amountMinor: 45_000_00,
      currency: "USD",
      sourceUrl: "https://example.edu/tuition",
    },
    languages: ["English"],
    facts: [fact()],
    ...overrides,
  };
}

describe("buildComparisonGroups", () => {
  it("returns no groups for an empty shortlist", () => {
    expect(buildComparisonGroups([])).toEqual([]);
  });

  it("groups summary, tuition, and dynamic field facts", () => {
    const groups = buildComparisonGroups([
      university("a"),
      university("b", { city: "New York" }),
    ]);

    expect(groups.map((group) => group.id)).toEqual([
      "overview",
      "tuition",
      "field-facts",
    ]);
    expect(groups[0].rows.map((row) => row.id)).toEqual([
      "ranking",
      "location",
      "institution-type",
      "official-website",
      "languages",
      "programs",
      "record-status",
    ]);
    expect(groups[0].rows.find((row) => row.id === "ranking")?.differs).toBe(
      false,
    );
    expect(groups[0].rows.find((row) => row.id === "location")?.differs).toBe(
      true,
    );
    expect(groups[2].rows[0].label).toBe("Acceptance rate");
  });

  it("preserves fact provenance and marks derived values", () => {
    const groups = buildComparisonGroups([university("a"), university("b")]);
    const factCell = groups[2].rows[0].cells[0];

    expect(factCell.value).toBe("20%");
    expect(factCell.status).toBe("PARTIALLY_VERIFIED");
    expect(factCell.sourceUrl).toBe("https://example.edu/facts");
    expect(factCell.verifiedAt).toBe("2026-10-01");
    expect(factCell.academicYear).toBe("2027");
    expect(factCell.detail).toContain("Academic year 2027");

    const tuitionCell = groups[1].rows[0].cells[0];
    expect(tuitionCell.value).toBe(formatMoney(45_000_00, "USD"));
    expect(tuitionCell.currency).toBe("USD");
    expect(tuitionCell.derived).toBe(true);
    expect(tuitionCell.note).toContain("No currency conversion is made");
  });

  it("renders a missing dynamic field as unavailable and different", () => {
    const groups = buildComparisonGroups([
      university("a"),
      university("b", { facts: [] }),
    ]);
    const row = groups[2].rows.find(
      (item) => item.id === "fact:acceptance_rate",
    );

    expect(row?.differs).toBe(true);
    expect(row?.cells[1].available).toBe(false);
    expect(row?.cells[1].status).toBe("INFORMATION_UNAVAILABLE");
    expect(row?.cells[1].value).toBeNull();
  });

  it("omits the field facts group when only handled keys are present", () => {
    const groups = buildComparisonGroups([
      university("a", {
        facts: [
          fact({
            fieldKey: "institution_type",
            label: "Institution type",
            value: "Public",
          }),
        ],
      }),
    ]);

    expect(groups.map((group) => group.id)).toEqual(["overview", "tuition"]);
  });
});

describe("comparison row counters", () => {
  it("counts value differences, not source differences", () => {
    const groups = buildComparisonGroups([
      university("a"),
      university("b", {
        websiteUrl: "https://a.edu",
        facts: [fact({ sourceUrl: "https://other.example/facts" })],
        lowestAnnualTuition: {
          amountMinor: 45_000_00,
          currency: "USD",
          sourceUrl: "https://other.example/tuition",
        },
      }),
    ]);

    expect(countDifferentRows(groups)).toBe(0);
  });

  it("counts source-linked cells across groups", () => {
    const groups = buildComparisonGroups([university("a"), university("b")]);

    expect(countSourcedFields(groups)).toBe(4);
  });
});
