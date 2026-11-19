import { describe, expect, it } from "vitest";

import {
  CLASSIFICATION_DISCLOSURE,
  classifyUniversity,
  type ClassificationInput,
} from "@/lib/advisor/classification";

const base: ClassificationInput = {
  rankPosition: 150,
  rankDisplay: "150",
  annualTuitionMinor: 2_000_000, // 20,000 EUR
  tuitionCurrency: "EUR",
  budgetMajor: 30_000,
  budgetCurrency: "EUR",
  offersTargetDegree: true,
  offersField: true,
};

describe("classifyUniversity", () => {
  it("uses QS rank bands for the base category", () => {
    expect(
      classifyUniversity({ ...base, rankPosition: 10, rankDisplay: "=10" })
        .category,
    ).toBe("Reach");
    expect(classifyUniversity({ ...base, rankPosition: 150 }).category).toBe(
      "Target",
    );
    expect(
      classifyUniversity({ ...base, rankPosition: 600, rankDisplay: "601-650" })
        .category,
    ).toBe("Likely");
  });

  it("preserves published tie and range strings in the reason", () => {
    expect(
      classifyUniversity({ ...base, rankPosition: 2, rankDisplay: "=2" })
        .reason,
    ).toContain("QS 2027 rank =2");
    expect(
      classifyUniversity({
        ...base,
        rankPosition: 600,
        rankDisplay: "601-650",
      }).reason,
    ).toContain("QS 2027 rank 601-650");
  });

  it("treats an unranked university as a likely planning estimate", () => {
    const result = classifyUniversity({
      ...base,
      rankPosition: null,
      rankDisplay: null,
    });
    expect(result.category).toBe("Likely");
    expect(result.reason).toMatch(/no QS 2027 rank/i);
    expect(result.reason).toMatch(/within the saved budget/i);
    expect(result.missingFacts).toEqual([]);
  });

  it("nudges over-budget options one band higher", () => {
    const result = classifyUniversity({
      ...base,
      annualTuitionMinor: 5_000_000,
    });
    expect(result.category).toBe("Reach");
    expect(result.reason).toMatch(/above the saved budget/i);
  });

  it("does not compare tuition across different currencies", () => {
    const result = classifyUniversity({ ...base, budgetCurrency: "USD" });
    expect(result.budgetComparable).toBe(false);
    expect(result.category).toBe("Target");
    expect(result.missingFacts).toContain(
      "a comparable tuition and budget currency",
    );
  });

  it("reports missing degree and field matches without guessing", () => {
    const result = classifyUniversity({
      ...base,
      offersTargetDegree: false,
      offersField: false,
    });
    expect(result.missingFacts).toContain("a matching target degree");
    expect(result.missingFacts).toContain("a matching field of study");
  });

  it("always exposes an estimate-not-guarantee disclosure", () => {
    expect(CLASSIFICATION_DISCLOSURE).toMatch(/not .*guarantee/i);
    expect(CLASSIFICATION_DISCLOSURE).toMatch(/QS 2027/);
  });
});
