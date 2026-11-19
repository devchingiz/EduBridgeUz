import { describe, expect, it } from "vitest";

import {
  deadlineFactSchema,
  isHttpUrl,
  monthDaySchema,
  provenanceResponseSchema,
  provenanceSchema,
  requirementFactSchema,
} from "@/lib/catalog/provenance";

const verifiedSource = {
  id: "source_1",
  url: "https://www.tum.de/en/studies/degree-programs/",
  publisher: "Technical University of Munich",
  title: "Informatics (Master of Science)",
  accessedAt: "2026-11-12",
  verifiedAt: "2026-11-12",
};

function provenance(overrides: Record<string, unknown> = {}) {
  return {
    status: "VERIFIED",
    verifiedAt: "2026-11-12",
    nextReviewAt: "2027-05-11",
    source: verifiedSource,
    ...overrides,
  };
}

describe("isHttpUrl", () => {
  it("accepts http and https URLs", () => {
    expect(isHttpUrl("https://example.edu/page")).toBe(true);
    expect(isHttpUrl("http://example.edu")).toBe(true);
  });

  it("rejects other schemes and malformed values", () => {
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("ftp://example.edu")).toBe(false);
    expect(isHttpUrl("not a url")).toBe(false);
  });
});

describe("provenanceSchema", () => {
  it("accepts a verified record with a dated source", () => {
    expect(provenanceSchema.safeParse(provenance()).success).toBe(true);
  });

  it("rejects a verified record without a reviewer date", () => {
    const result = provenanceSchema.safeParse(provenance({ verifiedAt: null }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.map((issue) => issue.path.join(".")),
      ).toContain("verifiedAt");
    }
  });

  it("rejects a verified record without a source", () => {
    const result = provenanceSchema.safeParse(provenance({ source: null }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.map((issue) => issue.path.join(".")),
      ).toContain("source");
    }
  });

  it("rejects a verified source that was never checked", () => {
    const result = provenanceSchema.safeParse(
      provenance({ source: { ...verifiedSource, verifiedAt: null } }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.map((issue) => issue.path.join(".")),
      ).toContain("source.verifiedAt");
    }
  });

  it("rejects a next review date before the verification date", () => {
    const result = provenanceSchema.safeParse(
      provenance({ nextReviewAt: "2026-01-01" }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.map((issue) => issue.path.join(".")),
      ).toContain("nextReviewAt");
    }
  });

  it("rejects a non-http source URL even for unverified records", () => {
    const result = provenanceSchema.safeParse(
      provenance({
        status: "UNVERIFIED",
        verifiedAt: null,
        nextReviewAt: null,
        source: { ...verifiedSource, url: "javascript:alert(1)" },
      }),
    );
    expect(result.success).toBe(false);
  });

  it("allows an unverified record with no evidence at all", () => {
    expect(
      provenanceSchema.safeParse({
        status: "UNVERIFIED",
        verifiedAt: null,
        nextReviewAt: null,
        source: null,
      }).success,
    ).toBe(true);
  });
});

describe("requirementFactSchema", () => {
  it("requires at least five characters of description", () => {
    const base = {
      id: "req_1",
      kind: "ACADEMIC",
      summary: "Too short",
      provenance: provenance(),
    };
    expect(requirementFactSchema.safeParse(base).success).toBe(true);
    expect(
      requirementFactSchema.safeParse({ ...base, summary: "Hi" }).success,
    ).toBe(false);
  });

  it("applies the provenance rule to the fact", () => {
    const result = requirementFactSchema.safeParse({
      id: "req_1",
      kind: "ACADEMIC",
      summary: "A recognized bachelor's degree in informatics.",
      provenance: provenance({ verifiedAt: null }),
    });
    expect(result.success).toBe(false);
  });
});

describe("deadlineFactSchema", () => {
  const base = {
    id: "deadline_1",
    cycle: "Winter semester",
    applicantGroup: null,
    opensOn: null,
    deadlineOn: null,
    opensMonthDay: null,
    deadlineMonthDay: null,
    note: null,
    provenance: provenance({
      status: "UNVERIFIED",
      verifiedAt: null,
      nextReviewAt: null,
      source: null,
    }),
  };

  it("requires a date or an explanatory note", () => {
    expect(deadlineFactSchema.safeParse(base).success).toBe(false);
    expect(
      deadlineFactSchema.safeParse({ ...base, note: "Dates not yet published" })
        .success,
    ).toBe(true);
  });

  it("rejects an exact date and a recurring month-day together", () => {
    const result = deadlineFactSchema.safeParse({
      ...base,
      deadlineOn: "2027-01-15",
      deadlineMonthDay: "01-15",
    });
    expect(result.success).toBe(false);
  });

  it("accepts an exact date", () => {
    expect(
      deadlineFactSchema.safeParse({ ...base, deadlineOn: "2027-01-15" })
        .success,
    ).toBe(true);
  });

  it("accepts a recurring month-day", () => {
    expect(
      deadlineFactSchema.safeParse({ ...base, deadlineMonthDay: "01-15" })
        .success,
    ).toBe(true);
  });
});

describe("monthDaySchema", () => {
  it("accepts a valid month and day", () => {
    expect(monthDaySchema.safeParse("02-01").success).toBe(true);
    expect(monthDaySchema.safeParse("12-31").success).toBe(true);
  });

  it("rejects out-of-range months and days", () => {
    expect(monthDaySchema.safeParse("13-01").success).toBe(false);
    expect(monthDaySchema.safeParse("00-10").success).toBe(false);
    expect(monthDaySchema.safeParse("02-32").success).toBe(false);
    expect(monthDaySchema.safeParse("2-1").success).toBe(false);
  });
});

describe("provenanceResponseSchema", () => {
  const response = {
    entity: {
      id: "program_1",
      type: "PROGRAM",
      slug: "msc-informatics",
      name: "Informatics",
    },
    status: "VERIFIED",
    lastVerifiedAt: "2026-11-12",
    nextReviewAt: "2027-05-11",
    sources: [verifiedSource],
    facts: [
      {
        key: "duration",
        label: "Duration",
        value: "24 months",
        provenance: provenance(),
      },
    ],
  };

  it("accepts a fully sourced response", () => {
    expect(provenanceResponseSchema.safeParse(response).success).toBe(true);
  });

  it("rejects a verified response with no sources", () => {
    const result = provenanceResponseSchema.safeParse({
      ...response,
      sources: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.map((issue) => issue.path.join(".")),
      ).toContain("sources");
    }
  });

  it("allows an unverified response with no sources", () => {
    expect(
      provenanceResponseSchema.safeParse({
        ...response,
        status: "UNVERIFIED",
        lastVerifiedAt: null,
        nextReviewAt: null,
        sources: [],
      }).success,
    ).toBe(true);
  });
});
