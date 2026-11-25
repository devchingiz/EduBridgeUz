import { describe, expect, it } from "vitest";

import {
  canFeatureCatalogRecord,
  catalogRevalidationPaths,
  normaliseCatalogLabel,
  resolveCatalogStatusAction,
  scholarshipDuplicateKey,
  scholarshipMissingInfo,
  slugFromCatalogName,
  universityDuplicateKey,
  universityMissingInfo,
} from "@/lib/admin/catalog-management";

describe("admin catalog status rules", () => {
  it("publishes only with a verified source and carries the review dates", () => {
    const transition = resolveCatalogStatusAction(
      "PUBLISH",
      "UNVERIFIED",
      "2026-11-20",
    );
    expect(transition).toMatchObject({
      ok: true,
      update: {
        status: "VERIFIED",
        decision: "APPROVE",
        lastVerifiedAt: new Date("2026-11-20T00:00:00.000Z"),
        nextReviewAt: new Date("2027-05-19T00:00:00.000Z"),
      },
    });
  });

  it("refuses to publish an unverified source or an archived record", () => {
    expect(resolveCatalogStatusAction("PUBLISH", "UNVERIFIED", null)).toEqual({
      ok: false,
      reason: "source_unverified",
    });
    expect(
      resolveCatalogStatusAction("PUBLISH", "ARCHIVED", "2026-11-20"),
    ).toEqual({ ok: false, reason: "invalid_state" });
  });

  it("unpublishes and archives to safe states, and restores only archives", () => {
    expect(
      resolveCatalogStatusAction("UNPUBLISH", "VERIFIED", "2026-11-20"),
    ).toMatchObject({
      ok: true,
      update: { status: "UNVERIFIED", decision: "REQUEST_CHANGES" },
    });
    expect(
      resolveCatalogStatusAction("ARCHIVE", "UNVERIFIED", "2026-11-20"),
    ).toMatchObject({
      ok: true,
      update: { status: "ARCHIVED", decision: "ARCHIVE" },
    });
    expect(
      resolveCatalogStatusAction("RESTORE", "ARCHIVED", "2026-11-20"),
    ).toMatchObject({
      ok: true,
      update: { status: "UNVERIFIED", decision: "RESTORE" },
    });
    expect(
      resolveCatalogStatusAction("RESTORE", "VERIFIED", "2026-11-20"),
    ).toEqual({ ok: false, reason: "invalid_state" });
  });

  it("only features published, sourced records", () => {
    expect(
      canFeatureCatalogRecord({
        status: "VERIFIED",
        sourceVerifiedAt: "2026-11-20",
      }),
    ).toEqual({ ok: true });
    expect(
      canFeatureCatalogRecord({ status: "UNVERIFIED", sourceVerifiedAt: null }),
    ).toEqual({ ok: false, reason: "not_published" });
    expect(
      canFeatureCatalogRecord({ status: "VERIFIED", sourceVerifiedAt: null }),
    ).toEqual({ ok: false, reason: "source_unverified" });
  });
});

describe("admin catalog fingerprints and warnings", () => {
  it("normalises names for duplicate detection and slugs", () => {
    expect(normaliseCatalogLabel("  Instituto Tecnológico de Örebrö ")).toBe(
      "instituto tecnologico de orebro",
    );
    expect(slugFromCatalogName("National University of Uzbekistan!")).toBe(
      "national-university-of-uzbekistan",
    );
    expect(
      universityDuplicateKey({
        name: "Example University",
        city: "Berlin",
        countryCode: "de",
      }),
    ).toBe(
      universityDuplicateKey({
        name: "example  university",
        city: "BERLIN",
        countryCode: "DE",
      }),
    );
    expect(
      scholarshipDuplicateKey({
        name: "Global Fund",
        providerName: "Example Foundation",
      }),
    ).toBe("global fund|example foundation");
  });

  it("reports missing profile and provenance information", () => {
    const warnings = universityMissingInfo({
      status: "VERIFIED",
      sourceVerifiedAt: "2026-11-20",
      nextReviewAt: null,
      websiteUrl: null,
      description: "A described university.",
      continent: "Europe",
      institutionType: "Public",
      rankingDisplay: "42",
      programCount: 0,
    });
    expect(warnings).toContain("A published record needs a next review date.");
    expect(warnings).toContain("No verified official website is stored.");
    expect(warnings).toContain("No programs are attached to this university.");
  });

  it("reports scholarship profile and evidence gaps", () => {
    const warnings = scholarshipMissingInfo({
      status: "VERIFIED",
      sourceVerifiedAt: "2026-11-20",
      nextReviewAt: "2027-05-19",
      summary: "Too short",
      providerUrl: "https://foundation.example/scholarship",
      hostCountryCode: null,
      degreeLevels: [],
      fields: ["Computer Science"],
      nationalityScope: "UNKNOWN",
      requirementCount: 0,
      deadlineCount: 0,
    });
    expect(warnings).toContain("The summary is too short.");
    expect(warnings).toContain("The host country is missing.");
    expect(warnings).toContain("No eligible degree levels are documented.");
    expect(warnings).toContain("The nationality scope is not documented.");
    expect(warnings).toContain("No requirements are recorded.");
    expect(warnings).toContain("No deadline is recorded.");
  });

  it("includes public and AI-facing paths in revalidation", () => {
    const paths = catalogRevalidationPaths("UNIVERSITY", "example-university");
    expect(paths).toContain("/universities");
    expect(paths).toContain("/dashboard/universities");
    expect(paths).toContain("/dashboard/universities/example-university");
    expect(paths).toContain("/admin/universities");

    const scholarshipPaths = catalogRevalidationPaths(
      "SCHOLARSHIP",
      "global-fund",
    );
    expect(scholarshipPaths).toContain("/scholarships");
    expect(scholarshipPaths).toContain("/dashboard/scholarships");
    expect(scholarshipPaths).toContain("/dashboard/scholarships/global-fund");
    expect(scholarshipPaths).toContain("/admin/scholarships");
  });
});
