import { describe, expect, it } from "vitest";

import {
  scholarshipFieldInput,
  zodFieldErrors,
} from "@/lib/admin/catalog-validation";
import { scholarshipFieldsSchema } from "@/lib/catalog/review-validation";

describe("administrative scholarship field normalisation", () => {
  it("turns delimited cells and repeated controls into schema-ready arrays", () => {
    const raw = scholarshipFieldInput({
      name: "Global Opportunity Fund",
      slug: "global-opportunity-fund",
      providerName: "Example Foundation",
      providerUrl: "https://foundation.example/scholarship",
      hostCountryCode: "",
      fundingType: "FULLY_FUNDED",
      degreeLevels: "MASTER|PHD",
      nationalityScope: "LISTED",
      eligibleNationalities: ["US", "DE"],
      fieldScope: "ALL",
      fields: "Computer Science|Engineering",
      summary:
        "A fully funded postgraduate scholarship for international students.",
    });

    expect(raw.degreeLevels).toEqual(["MASTER", "PHD"]);
    expect(raw.eligibleNationalities).toEqual(["US", "DE"]);
    expect(raw.fields).toEqual(["Computer Science", "Engineering"]);

    const parsed = scholarshipFieldsSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.hostCountryCode).toBeNull();
      expect(parsed.data.degreeLevels).toEqual(["MASTER", "PHD"]);
    }
  });

  it("treats an omitted optional country column as null for CSV imports", () => {
    const raw = scholarshipFieldInput({
      name: "Omitted Country Fund",
      slug: "omitted-country-fund",
      providerName: "Example Foundation",
      providerUrl: "https://foundation.example/omitted-country",
      fundingType: "STIPEND",
      degreeLevels: "MASTER",
      nationalityScope: "ALL",
      fieldScope: "ALL",
      fields: "Engineering",
      summary: "A sourced scholarship summary with no host country column.",
    });

    expect(raw.hostCountryCode).toBeNull();
    expect(scholarshipFieldsSchema.safeParse(raw).success).toBe(true);
  });

  it("rejects empty degree lists and invalid enum values with field errors", () => {
    const parsed = scholarshipFieldsSchema.safeParse(
      scholarshipFieldInput({
        name: "Invalid Scholarship",
        slug: "invalid-scholarship",
        providerName: "Example Foundation",
        providerUrl: "https://foundation.example/scholarship",
        fundingType: "NOT_A_FUNDING_TYPE",
        degreeLevels: "",
        nationalityScope: "ALL",
        fieldScope: "ALL",
        fields: "",
        summary: "A scholarship summary that is long enough to be accepted.",
      }),
    );

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const errors = zodFieldErrors(parsed.error);
      expect(errors.fundingType).toBeTruthy();
      expect(errors.degreeLevels).toBeTruthy();
    }
  });
});
