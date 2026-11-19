import { describe, expect, it } from "vitest";

import type { FieldVerificationStatusValue } from "@/lib/catalog/constants";
import { groupFieldFacts } from "@/lib/catalog/fact-groups";

type Fact = {
  label: string;
  value: string | null;
  status: FieldVerificationStatusValue;
  sourceUrl: string | null;
};

describe("groupFieldFacts", () => {
  it("separates usable sourced values from explicit gaps", () => {
    const facts: Fact[] = [
      {
        label: "Verified value",
        value: "Public",
        status: "VERIFIED",
        sourceUrl: "https://example.edu/type",
      },
      {
        label: "Missing value",
        value: null,
        status: "INFORMATION_UNAVAILABLE",
        sourceUrl: null,
      },
      {
        label: "Partially verified value",
        value: "#101",
        status: "PARTIALLY_VERIFIED",
        sourceUrl: "https://example.edu/ranking",
      },
      {
        label: "Whitespace value",
        value: "   ",
        status: "VERIFIED",
        sourceUrl: "https://example.edu/blank",
      },
      {
        label: "Unverified value",
        value: "Unchecked claim",
        status: "NOT_VERIFIED",
        sourceUrl: null,
      },
    ];

    const { confirmed, unconfirmed } = groupFieldFacts(facts);

    expect(confirmed.map((fact) => fact.label)).toEqual([
      "Verified value",
      "Partially verified value",
    ]);
    expect(unconfirmed.map((fact) => fact.label)).toEqual([
      "Missing value",
      "Whitespace value",
      "Unverified value",
    ]);
    expect(confirmed[0]).toBe(facts[0]);
    expect(unconfirmed[2]).toBe(facts[4]);
  });

  it("returns two empty groups when no facts are supplied", () => {
    expect(groupFieldFacts<Fact>([])).toEqual({
      confirmed: [],
      unconfirmed: [],
    });
  });
});
