import { describe, expect, it } from "vitest";

import {
  degreeLevel,
  durationMonths,
  feeCurrency,
  isHttpUrl,
  legacySeedSlug,
  programmeField,
  slugify,
  validateQsDataset,
  type QsDatasetLike,
} from "@/lib/catalog/qs-import-mapping";

function university(
  overrides: Partial<{
    qsNid: number;
    name: string;
    slug: string;
    rankPosition: number;
    qsSourceUrl: string;
  }> = {},
) {
  return {
    qsNid: 1,
    name: "Example University",
    slug: "example-university",
    rankPosition: 100,
    qsSourceUrl: "https://www.topuniversities.com/universities/example",
    ...overrides,
  };
}

function dataset(universities: ReturnType<typeof university>[]): QsDatasetLike {
  return { meta: { retrievedAt: "2026-06-18" }, universities };
}

describe("validateQsDataset", () => {
  it("accepts a valid dataset with the expected count", () => {
    expect(() => validateQsDataset(dataset([university()]), 1)).not.toThrow();
  });

  it("rejects a missing meta block or university list", () => {
    expect(() => validateQsDataset(null, 1)).toThrow(/missing meta/i);
    expect(() => validateQsDataset({ universities: [] }, 0)).toThrow(
      /missing meta/i,
    );
  });

  it("rejects a count mismatch", () => {
    expect(() => validateQsDataset(dataset([university()]), 2)).toThrow(
      /expected 2/i,
    );
  });

  it("rejects duplicate names, nid values and slugs", () => {
    expect(() =>
      validateQsDataset(dataset([university(), university()]), 2),
    ).toThrow(/duplicate/i);

    expect(() =>
      validateQsDataset(
        dataset([
          university({ qsNid: 1 }),
          university({ qsNid: 1, name: "Other", slug: "other" }),
        ]),
        2,
      ),
    ).toThrow(/duplicate/i);
  });

  it("rejects invalid ranks and non-http source urls", () => {
    expect(() =>
      validateQsDataset(dataset([university({ rankPosition: Number.NaN })]), 1),
    ).toThrow(/rank/i);
    expect(() =>
      validateQsDataset(
        dataset([university({ qsSourceUrl: "javascript:alert(1)" })]),
        1,
      ),
    ).toThrow(/source url/i);
  });
});

describe("legacySeedSlug", () => {
  it("strips a leading article used by legacy seed slugs", () => {
    expect(legacySeedSlug("the-university-of-manchester")).toBe(
      "university-of-manchester",
    );
  });

  it("leaves other slugs untouched", () => {
    expect(legacySeedSlug("university-of-amsterdam")).toBe(
      "university-of-amsterdam",
    );
  });
});

describe("degreeLevel", () => {
  const program = (
    overrides: Partial<{
      degree: string | null;
      studyLevel: string | null;
    }>,
  ) => ({
    name: "Programme",
    degree: null,
    studyLevel: null,
    duration: null,
    fee: null,
    sourceUrl: "https://example.com",
    ...overrides,
  });

  it("maps explicit study levels", () => {
    expect(degreeLevel(program({ studyLevel: "bachelors" }))).toBe("BACHELOR");
    expect(degreeLevel(program({ studyLevel: "phd" }))).toBe("PHD");
    expect(degreeLevel(program({ studyLevel: "mba" }))).toBe("MASTER");
  });

  it("maps common degree abbreviations", () => {
    expect(degreeLevel(program({ degree: "BSc Computer Science" }))).toBe(
      "BACHELOR",
    );
    expect(degreeLevel(program({ degree: "MSc Data Science" }))).toBe("MASTER");
    expect(degreeLevel(program({ degree: "PhD Physics" }))).toBe("PHD");
  });

  it("returns null instead of guessing an unknown level", () => {
    expect(degreeLevel(program({ degree: "Foundation" }))).toBeNull();
  });
});

describe("programmeField", () => {
  it("classifies known subjects", () => {
    expect(programmeField("MSc Computer Science")).toBe("Computer Science");
    expect(programmeField("MBA Business Administration")).toBe("Business");
    expect(programmeField("MD Medicine")).toBe("Medicine");
  });

  it("returns an explicit fallback for unknown subjects", () => {
    expect(programmeField("Studies in Everything")).toBe("Not classified");
  });
});

describe("durationMonths", () => {
  it("converts years to months", () => {
    expect(durationMonths("2 years")).toBe(24);
  });

  it("keeps months as-is", () => {
    expect(durationMonths("18 months")).toBe(18);
  });

  it("returns null for absent or unparseable values", () => {
    expect(durationMonths(null)).toBeNull();
    expect(durationMonths("full time")).toBeNull();
  });
});

describe("feeCurrency", () => {
  it("extracts an ISO currency code", () => {
    expect(feeCurrency("EUR 20,000 per year")).toBe("EUR");
  });

  it("returns null when no currency code is present", () => {
    expect(feeCurrency(null)).toBeNull();
    expect(feeCurrency("Tuition available on request")).toBeNull();
  });
});

describe("isHttpUrl and slugify", () => {
  it("only accepts http(s) urls", () => {
    expect(isHttpUrl("https://example.com")).toBe(true);
    expect(isHttpUrl("http://example.com")).toBe(true);
    expect(isHttpUrl("ftp://example.com")).toBe(false);
    expect(isHttpUrl("not a url")).toBe(false);
  });

  it("produces stable ASCII slugs", () => {
    expect(slugify("Technische Universität München")).toBe(
      "technische-universitat-munchen",
    );
    expect(slugify("  A  &  B  ")).toBe("a-b");
  });
});
