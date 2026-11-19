import "server-only";

import { PUBLIC_VISIBLE_STATUSES } from "@/lib/catalog/constants";
import { toFieldFact } from "@/lib/catalog/discovery-queries";
import type { FieldFactDto } from "@/lib/catalog/provenance";
import { db } from "@/lib/db";

/** The shortlist is deliberately capped so side-by-side tables stay readable. */
export const MAX_COMPARISON_UNIVERSITIES = 4;

export type ComparisonUniversity = {
  id: string;
  slug: string;
  name: string;
  city: string;
  countryCode: string;
  websiteUrl: string | null;
  continent: string | null;
  institutionType: string | null;
  logoUrl: string | null;
  rankingDisplay: string | null;
  status: string;
  programCount: number;
  lowestAnnualTuition: {
    amountMinor: number;
    currency: string;
    sourceUrl: string | null;
  } | null;
  languages: string[];
  facts: FieldFactDto[];
};

export type ComparisonResult =
  { ok: true; universityIds: string[] } | { ok: false; message: string };

const visibleStatuses = [...PUBLIC_VISIBLE_STATUSES];
const annualPeriods = ["per year", "per annum", "annual", "annually", "yearly"];

function isAnnual(period: string): boolean {
  return annualPeriods.includes(period.trim().toLowerCase());
}

/** Lightweight id lookup for rendering saved-state buttons on detail pages. */
export async function getComparisonIds(userId: string): Promise<string[]> {
  const row = await db.universityComparison.findUnique({
    where: { userId },
    select: { universityIds: true },
  });
  return row?.universityIds ?? [];
}

/** Returns the user's shortlist in the order it was saved. */
export async function getComparison(
  userId: string,
): Promise<ComparisonUniversity[]> {
  const row = await db.universityComparison.findUnique({
    where: { userId },
    select: { universityIds: true },
  });
  if (!row || row.universityIds.length === 0) return [];

  const universities = await db.university.findMany({
    where: {
      id: { in: row.universityIds },
      verificationStatus: { in: visibleStatuses },
    },
    include: {
      fieldFacts: { orderBy: { fieldKey: "asc" } },
      programs: {
        where: { verificationStatus: { in: visibleStatuses } },
        include: {
          tuitionFacts: {
            where: { verificationStatus: { in: visibleStatuses } },
            select: {
              amountMinor: true,
              currency: true,
              period: true,
              source: { select: { url: true } },
            },
          },
        },
      },
    },
  });

  // Preserve the user's order and drop rows that became unavailable.
  const byId = new Map(
    universities.map((university) => [university.id, university]),
  );
  return row.universityIds.flatMap((id) => {
    const university = byId.get(id);
    if (!university) return [];

    const tuitionFacts = university.programs.flatMap((program) =>
      program.tuitionFacts.filter((fact) => isAnnual(fact.period)),
    );
    const lowest = tuitionFacts.sort(
      (a, b) => a.amountMinor - b.amountMinor,
    )[0];

    return [
      {
        id: university.id,
        slug: university.slug,
        name: university.name,
        city: university.city,
        countryCode: university.countryCode,
        websiteUrl: university.websiteUrl,
        continent: university.continent,
        institutionType: university.institutionType,
        logoUrl: university.logoUrl,
        rankingDisplay: university.rankingDisplay,
        status: university.verificationStatus,
        programCount: university.programs.length,
        lowestAnnualTuition: lowest
          ? {
              amountMinor: lowest.amountMinor,
              currency: lowest.currency,
              sourceUrl: lowest.source?.url ?? null,
            }
          : null,
        languages: [
          ...new Set(
            university.programs
              .map((program) => program.language)
              .filter((language): language is string => Boolean(language)),
          ),
        ],
        facts: university.fieldFacts
          .map((fact) => toFieldFact(fact))
          .filter((fact): fact is FieldFactDto => fact !== null),
      },
    ];
  });
}

/**
 * Replaces the whole shortlist. Every id must resolve to a public university,
 * duplicates are removed and the four-item cap is enforced server-side.
 */
export async function setComparison(
  userId: string,
  universityIds: string[],
): Promise<ComparisonResult> {
  const unique = [...new Set(universityIds.filter(Boolean))];
  if (unique.length > MAX_COMPARISON_UNIVERSITIES) {
    return {
      ok: false,
      message: `You can compare at most ${MAX_COMPARISON_UNIVERSITIES} universities.`,
    };
  }

  if (unique.length > 0) {
    const count = await db.university.count({
      where: {
        id: { in: unique },
        verificationStatus: { in: visibleStatuses },
      },
    });
    if (count !== unique.length) {
      return {
        ok: false,
        message: "One or more universities are no longer available.",
      };
    }
  }

  await db.universityComparison.upsert({
    where: { userId },
    create: { userId, universityIds: unique },
    update: { universityIds: unique },
  });
  return { ok: true, universityIds: unique };
}

/** Adds one university to the current shortlist without exceeding the cap. */
export async function addToComparison(
  userId: string,
  universityId: string,
): Promise<ComparisonResult> {
  const row = await db.universityComparison.findUnique({
    where: { userId },
    select: { universityIds: true },
  });
  const current = row?.universityIds ?? [];
  if (current.includes(universityId)) {
    return { ok: true, universityIds: current };
  }
  if (current.length >= MAX_COMPARISON_UNIVERSITIES) {
    return {
      ok: false,
      message: `You can compare at most ${MAX_COMPARISON_UNIVERSITIES} universities. Remove one first.`,
    };
  }
  return setComparison(userId, [...current, universityId]);
}

export async function removeFromComparison(
  userId: string,
  universityId: string,
): Promise<ComparisonResult> {
  const row = await db.universityComparison.findUnique({
    where: { userId },
    select: { universityIds: true },
  });
  return setComparison(
    userId,
    (row?.universityIds ?? []).filter((id) => id !== universityId),
  );
}
