import { describe, expect, it } from "vitest";

import { isHttpUrl, monthDaySchema } from "@/lib/catalog/provenance";
import {
  seedCitations,
  seedScholarships,
  seedUniversities,
  type CitationKey,
} from "@/lib/catalog/seed-data";

const citationKeys = Object.keys(seedCitations) as CitationKey[];
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

describe("seed citations", () => {
  it("every citation is an official http(s) URL with access and verification dates", () => {
    for (const key of citationKeys) {
      const citation = seedCitations[key];
      expect(isHttpUrl(citation.url), key).toBe(true);
      expect(citation.accessedAt, key).toMatch(isoDate);
      expect(citation.verifiedAt, key).toMatch(isoDate);
      expect(citation.publisher.length, key).toBeGreaterThan(1);
      expect(citation.title.length, key).toBeGreaterThan(1);
    }
  });

  it("has no duplicate source URLs", () => {
    const urls = citationKeys.map((key) => seedCitations[key].url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});

function expectCitation(key: CitationKey | undefined, context: string) {
  expect(key, context).toBeTruthy();
  expect(citationKeys, context).toContain(key);
}

/**
 * A fact may omit `source`; the seed runner then attaches the record's primary
 * source. When a fact names a source, it must exist.
 */
function expectOptionalCitation(key: CitationKey | undefined, context: string) {
  if (key === undefined) return;
  expect(citationKeys, context).toContain(key);
}

describe("seed universities and programs", () => {
  it("has unique university and program slugs", () => {
    const universitySlugs = seedUniversities.map(
      (university) => university.slug,
    );
    expect(new Set(universitySlugs).size).toBe(universitySlugs.length);

    const programSlugs = seedUniversities.flatMap((university) =>
      university.programs.map(
        (program) => `${university.slug}/${program.slug}`,
      ),
    );
    expect(new Set(programSlugs).size).toBe(programSlugs.length);
  });

  it("every record and fact cites a known source", () => {
    for (const university of seedUniversities) {
      const context = university.slug;
      expect(isHttpUrl(university.websiteUrl), context).toBe(true);
      expect(university.countryCode, context).toMatch(/^[A-Z]{2}$/);
      expectCitation(university.source, context);

      for (const program of university.programs) {
        const programContext = `${context}/${program.slug}`;
        expectCitation(program.source, programContext);

        for (const intake of program.intakes ?? []) {
          expectOptionalCitation(intake.source, `${programContext} intake`);
          expect(["SPRING", "SUMMER", "AUTUMN", "WINTER"]).toContain(
            intake.term,
          );
        }

        for (const requirement of program.requirements) {
          expectOptionalCitation(
            requirement.source,
            `${programContext} requirement`,
          );
        }
        for (const tuition of program.tuition) {
          expectOptionalCitation(tuition.source, `${programContext} tuition`);
          expect(Number.isInteger(tuition.amountMinor), programContext).toBe(
            true,
          );
          expect(tuition.amountMinor, programContext).toBeGreaterThanOrEqual(0);
          expect(tuition.currency, programContext).toMatch(/^[A-Z]{3}$/);
        }
        for (const deadline of program.deadlines) {
          expectOptionalCitation(deadline.source, `${programContext} deadline`);
          expect(
            Boolean(
              deadline.deadlineOn || deadline.deadlineMonthDay || deadline.note,
            ),
            `${programContext} deadline needs a date or note`,
          ).toBe(true);
          if (deadline.deadlineMonthDay) {
            expect(
              monthDaySchema.safeParse(deadline.deadlineMonthDay).success,
              programContext,
            ).toBe(true);
          }
          if (deadline.opensMonthDay) {
            expect(
              monthDaySchema.safeParse(deadline.opensMonthDay).success,
              programContext,
            ).toBe(true);
          }
        }
      }
    }
  });
});

describe("seed scholarships", () => {
  it("has unique scholarship slugs", () => {
    const slugs = seedScholarships.map((scholarship) => scholarship.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every scholarship and fact cites a known source", () => {
    for (const scholarship of seedScholarships) {
      const context = scholarship.slug;
      expectCitation(scholarship.source, context);
      expect(isHttpUrl(scholarship.providerUrl), context).toBe(true);
      expect(scholarship.degreeLevels.length, context).toBeGreaterThan(0);
      expect(scholarship.summary.length, context).toBeGreaterThan(19);
      if (scholarship.hostCountryCode) {
        expect(scholarship.hostCountryCode, context).toMatch(/^[A-Z]{2}$/);
      }
      for (const nationality of scholarship.eligibleNationalities) {
        expect(nationality, context).toMatch(/^[A-Z]{2}$/);
      }

      for (const requirement of scholarship.requirements) {
        expectOptionalCitation(requirement.source, `${context} requirement`);
      }
      for (const deadline of scholarship.deadlines) {
        expectOptionalCitation(deadline.source, `${context} deadline`);
        expect(
          Boolean(
            deadline.deadlineOn || deadline.deadlineMonthDay || deadline.note,
          ),
          `${context} deadline needs a date or note`,
        ).toBe(true);
      }
    }
  });
});
