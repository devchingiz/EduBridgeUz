import { describe, expect, it } from "vitest";

import type { FieldVerificationStatusValue } from "@/lib/catalog/constants";
import {
  availableText,
  filterAvailableFacts,
  groupFieldFacts,
  hasAvailableFacts,
  isUnavailableText,
} from "@/lib/catalog/fact-groups";

type Fact = {
  label: string;
  value: string | null;
  status: FieldVerificationStatusValue;
  sourceUrl: string | null;
  note?: string | null;
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

describe("filterAvailableFacts", () => {
  const facts: Fact[] = [
    {
      label: "Verified",
      value: "Public",
      status: "VERIFIED",
      sourceUrl: "https://example.edu/type",
    },
    {
      label: "Partial",
      value: "#41",
      status: "PARTIALLY_VERIFIED",
      sourceUrl: "https://example.edu/rank",
    },
    {
      label: "Blank",
      value: "   ",
      status: "VERIFIED",
      sourceUrl: "https://example.edu/blank",
    },
    {
      label: "No value",
      value: null,
      status: "INFORMATION_UNAVAILABLE",
      sourceUrl: null,
    },
    {
      label: "Unverified",
      value: "Claim",
      status: "NOT_VERIFIED",
      sourceUrl: null,
    },
    {
      label: "Placeholder",
      value: "Not published",
      status: "PARTIALLY_VERIFIED",
      sourceUrl: "https://example.edu/gap",
    },
    {
      label: "Placeholder note",
      value: "Public",
      status: "VERIFIED",
      sourceUrl: "https://example.edu/type",
      note: "Intake months are not published in the index.",
    },
  ];

  it("keeps only sourced values with a usable status", () => {
    expect(filterAvailableFacts(facts).map((fact) => fact.label)).toEqual([
      "Verified",
      "Partial",
    ]);
  });

  it("reports whether any fact can be shown", () => {
    expect(hasAvailableFacts(facts)).toBe(true);
    expect(
      hasAvailableFacts(
        facts.filter(
          (fact) => fact.label !== "Verified" && fact.label !== "Partial",
        ),
      ),
    ).toBe(false);
  });
});

describe("availableText", () => {
  it("trims usable values", () => {
    expect(availableText("  Engineering  ")).toBe("Engineering");
  });

  it("drops placeholder wording", () => {
    expect(isUnavailableText("Not classified")).toBe(true);
    expect(isUnavailableText("Intake months are not published here")).toBe(
      true,
    );
    expect(availableText("Information unavailable")).toBeNull();
    expect(availableText("Not set")).toBeNull();
  });

  it("keeps legitimate provenance wording", () => {
    expect(
      availableText(
        "Sourced from QS; not checked against the institution's own current page.",
      ),
    ).toBe(
      "Sourced from QS; not checked against the institution's own current page.",
    );
  });

  it("cleans pasted markup before deciding whether a value is usable", () => {
    expect(availableText("<p>  Engineering &amp; IT  </p>")).toBe(
      "Engineering & IT",
    );
    expect(isUnavailableText("<p>Information unavailable</p>")).toBe(true);
    expect(availableText("<p><br/></p>")).toBeNull();
  });
});
