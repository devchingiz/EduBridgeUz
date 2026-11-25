import "server-only";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import {
  DISCOVERY_PAGE_SIZE,
  type UniversityDiscoveryFilters,
} from "@/lib/catalog/discovery-filters";
import { PUBLIC_VISIBLE_STATUSES } from "@/lib/catalog/constants";
import { fieldFactSchema, type FieldFactDto } from "@/lib/catalog/provenance";

const visibleStatuses = [...PUBLIC_VISIBLE_STATUSES];
const visibleStatusSet = new Set<string>(visibleStatuses);
const annualPeriods = ["per year", "per annum", "annual", "annually", "yearly"];

type Citation = {
  url: string;
  title: string;
  verifiedAt: Date | null;
};

function citation(source: Citation) {
  return {
    url: source.url,
    title: source.title,
    verifiedAt: source.verifiedAt?.toISOString().slice(0, 10) ?? null,
  };
}

function isoDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function toFieldFact(row: {
  id: string;
  fieldKey: string;
  label: string;
  value: string | null;
  status: FieldFactDto["status"];
  sourceUrl: string | null;
  sourceTitle: string | null;
  verifiedAt: Date | null;
  academicYear: string | null;
  intake: string | null;
  currency: string | null;
  unit: string | null;
  note: string | null;
}): FieldFactDto | null {
  const parsed = fieldFactSchema.safeParse({
    id: row.id,
    fieldKey: row.fieldKey,
    label: row.label,
    value: row.value,
    status: row.status,
    sourceUrl: row.sourceUrl,
    sourceTitle: row.sourceTitle,
    verifiedAt: isoDate(row.verifiedAt),
    academicYear: row.academicYear,
    intake: row.intake,
    currency: row.currency,
    unit: row.unit,
    note: row.note,
  });
  return parsed.success ? parsed.data : null;
}

function minorUnits(amount: number, currency: string): number {
  const fractionDigits =
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  return Math.round(amount * 10 ** fractionDigits);
}

function isAnnual(period: string): boolean {
  return annualPeriods.includes(period.trim().toLowerCase());
}

function annualTuition(
  programs: Array<{
    tuitionFacts: Array<{
      amountMinor: number;
      currency: string;
      period: string;
      applicantGroup: string | null;
      verificationStatus: string;
    }>;
  }>,
  currency: string,
) {
  const facts = programs.flatMap((program) =>
    program.tuitionFacts
      .filter(
        (fact) =>
          fact.currency === currency &&
          isAnnual(fact.period) &&
          visibleStatusSet.has(fact.verificationStatus),
      )
      .map((fact) => fact),
  );
  return facts.sort((a, b) => a.amountMinor - b.amountMinor)[0] ?? null;
}

function nextDeadline(
  programs: Array<{
    deadlineFacts: Array<{
      deadlineOn: Date | null;
      deadlineMonthDay: string | null;
      verificationStatus: string;
      source: Citation;
    }>;
  }>,
): {
  sortDate: number;
  label: string;
  source: ReturnType<typeof citation>;
} | null {
  const now = new Date();
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const candidates = programs.flatMap((program) =>
    program.deadlineFacts
      .filter((fact) => visibleStatusSet.has(fact.verificationStatus))
      .flatMap((fact) => {
        if (fact.deadlineOn) {
          const time = fact.deadlineOn.getTime();
          return time >= today
            ? [
                {
                  time,
                  label: fact.deadlineOn.toISOString().slice(0, 10),
                  source: fact.source,
                },
              ]
            : [];
        }
        if (!fact.deadlineMonthDay) return [];
        const [monthText, dayText] = fact.deadlineMonthDay.split("-");
        const month = Number(monthText);
        const day = Number(dayText);
        if (!month || !day) return [];
        let year = now.getUTCFullYear();
        let time = Date.UTC(year, month - 1, day);
        if (time < today) time = Date.UTC(++year, month - 1, day);
        return [
          {
            time,
            label: fact.deadlineMonthDay,
            source: fact.source,
          },
        ];
      }),
  );
  const nearest = candidates.sort((a, b) => a.time - b.time)[0];
  return nearest
    ? {
        sortDate: nearest.time,
        label: nearest.label,
        source: citation(nearest.source),
      }
    : null;
}

const discoveryInclude = {
  primarySource: { select: { url: true, title: true, verifiedAt: true } },
  fieldFacts: { orderBy: { fieldKey: "asc" } },
  programs: {
    where: { verificationStatus: { in: visibleStatuses } },
    include: {
      primarySource: { select: { url: true, title: true, verifiedAt: true } },
      tuitionFacts: {
        where: { verificationStatus: { in: visibleStatuses } },
        include: {
          source: { select: { url: true, title: true, verifiedAt: true } },
        },
      },
      costs: {
        where: { verificationStatus: { in: visibleStatuses } },
        include: {
          source: { select: { url: true, title: true, verifiedAt: true } },
        },
      },
      intakes: {
        where: { verificationStatus: { in: visibleStatuses } },
        include: {
          source: { select: { url: true, title: true, verifiedAt: true } },
        },
      },
      requirements: {
        where: { verificationStatus: { in: visibleStatuses } },
        include: {
          source: { select: { url: true, title: true, verifiedAt: true } },
        },
      },
      deadlineFacts: {
        where: { verificationStatus: { in: visibleStatuses } },
        include: {
          source: { select: { url: true, title: true, verifiedAt: true } },
        },
      },
      scholarships: {
        where: {
          verificationStatus: { in: visibleStatuses },
          scholarship: { verificationStatus: { in: visibleStatuses } },
        },
        include: {
          source: { select: { url: true, title: true, verifiedAt: true } },
          scholarship: {
            include: {
              primarySource: {
                select: { url: true, title: true, verifiedAt: true },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.UniversityInclude;

const discoveryListInclude = {
  programs: {
    where: { verificationStatus: { in: visibleStatuses } },
    select: {
      tuitionFacts: {
        where: { verificationStatus: { in: visibleStatuses } },
        select: {
          amountMinor: true,
          currency: true,
          period: true,
          applicantGroup: true,
          verificationStatus: true,
        },
      },
      deadlineFacts: {
        where: { verificationStatus: { in: visibleStatuses } },
        select: {
          deadlineOn: true,
          deadlineMonthDay: true,
          verificationStatus: true,
          source: { select: { url: true, title: true, verifiedAt: true } },
        },
      },
      scholarships: {
        where: {
          verificationStatus: { in: visibleStatuses },
          scholarship: { verificationStatus: { in: visibleStatuses } },
        },
        select: { verificationStatus: true },
      },
    },
  },
} satisfies Prisma.UniversityInclude;

export type UniversityDiscoveryCard = {
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
  featured: boolean;
  status: string;
  lastVerifiedAt: string | null;
  tuitionAmountMinor: number | null;
  tuitionApplicantGroup: string | null;
  tuitionCurrency: string;
  scholarshipAvailable: boolean;
  nearestDeadline: {
    label: string;
    source: ReturnType<typeof citation>;
  } | null;
  isFavorite: boolean;
  isTracked: boolean;
};

export type UniversityDiscoveryList = {
  items: UniversityDiscoveryCard[];
  total: number;
  page: number;
  pageCount: number;
};

export async function listUniversityDiscovery(
  filters: UniversityDiscoveryFilters,
  userId: string,
): Promise<UniversityDiscoveryList> {
  const programWhere: Prisma.ProgramWhereInput = {
    verificationStatus: { in: visibleStatuses },
    ...(filters.degree !== "all" ? { degreeLevel: filters.degree } : {}),
    ...(filters.intake !== "all"
      ? { intakes: { some: { term: filters.intake } } }
      : {}),
    ...(filters.maxTuition !== undefined
      ? {
          tuitionFacts: {
            some: {
              currency: filters.currency,
              amountMinor: {
                lte: minorUnits(filters.maxTuition, filters.currency),
              },
              period: { in: annualPeriods, mode: "insensitive" },
              verificationStatus: { in: visibleStatuses },
            },
          },
        }
      : {}),
  };
  const scholarshipLinkWhere: Prisma.ProgramScholarshipWhereInput = {
    verificationStatus: { in: visibleStatuses },
    scholarship: { verificationStatus: { in: visibleStatuses } },
  };
  const needsMatchingProgram =
    filters.degree !== "all" ||
    filters.intake !== "all" ||
    filters.maxTuition !== undefined ||
    filters.scholarship === "yes";

  const where: Prisma.UniversityWhereInput = {
    verificationStatus: { in: visibleStatuses },
    ...(filters.country !== "all" ? { countryCode: filters.country } : {}),
    ...(filters.continent !== "all" ? { continent: filters.continent } : {}),
    ...(filters.institutionType !== "all"
      ? { institutionType: filters.institutionType }
      : {}),
    ...(filters.q
      ? {
          name: { contains: filters.q, mode: "insensitive" },
        }
      : {}),
    ...(needsMatchingProgram || filters.scholarship === "no"
      ? {
          programs: {
            ...(needsMatchingProgram
              ? {
                  some: {
                    ...programWhere,
                    ...(filters.scholarship === "yes"
                      ? { scholarships: { some: scholarshipLinkWhere } }
                      : {}),
                  },
                }
              : {}),
            ...(filters.scholarship === "no"
              ? {
                  none: {
                    scholarships: { some: scholarshipLinkWhere },
                  },
                }
              : {}),
          },
        }
      : {}),
  };

  const total = await db.university.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / DISCOVERY_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const rows = await db.university.findMany({
    where,
    include: discoveryListInclude,
    orderBy: [{ featured: "desc" }, { name: "asc" }],
    ...(filters.sort === "name"
      ? {
          skip: (page - 1) * DISCOVERY_PAGE_SIZE,
          take: DISCOVERY_PAGE_SIZE,
        }
      : {}),
  });
  const sortedItems = rows.map((row) => {
    const deadline = nextDeadline(row.programs);
    const tuition = annualTuition(row.programs, filters.currency);
    return {
      sortDeadline: deadline?.sortDate ?? Number.POSITIVE_INFINITY,
      item: {
        id: row.id,
        slug: row.slug,
        name: row.name,
        city: row.city,
        countryCode: row.countryCode,
        websiteUrl: row.websiteUrl,
        continent: row.continent,
        institutionType: row.institutionType,
        logoUrl: row.logoUrl,
        rankingDisplay: row.rankingDisplay,
        featured: row.featured,
        status: row.verificationStatus,
        lastVerifiedAt: row.lastVerifiedAt?.toISOString().slice(0, 10) ?? null,
        tuitionAmountMinor: tuition?.amountMinor ?? null,
        tuitionApplicantGroup: tuition?.applicantGroup ?? null,
        tuitionCurrency: filters.currency,
        scholarshipAvailable: row.programs.some((program) =>
          program.scholarships.some((link) =>
            visibleStatusSet.has(link.verificationStatus),
          ),
        ),
        nearestDeadline: deadline
          ? { label: deadline.label, source: deadline.source }
          : null,
        isFavorite: false,
        isTracked: false,
      } satisfies UniversityDiscoveryCard,
    };
  });

  if (filters.sort === "tuition") {
    sortedItems.sort((left, right) => {
      const a = left.item;
      const b = right.item;
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      if (a.tuitionAmountMinor === null)
        return b.tuitionAmountMinor === null ? 0 : 1;
      if (b.tuitionAmountMinor === null) return -1;
      return (
        a.tuitionAmountMinor - b.tuitionAmountMinor ||
        a.name.localeCompare(b.name)
      );
    });
  } else if (filters.sort === "deadline") {
    sortedItems.sort((a, b) => {
      return (
        Number(b.item.featured) - Number(a.item.featured) ||
        a.sortDeadline - b.sortDeadline ||
        a.item.name.localeCompare(b.item.name)
      );
    });
  }

  const start = (page - 1) * DISCOVERY_PAGE_SIZE;
  const pageRows =
    filters.sort === "name"
      ? sortedItems
      : sortedItems.slice(start, start + DISCOVERY_PAGE_SIZE);
  const ids = pageRows.map(({ item }) => item.id);
  const [favoriteRows, trackedRows] = await Promise.all([
    db.universityFavorite.findMany({
      where: { userId, universityId: { in: ids } },
      select: { universityId: true },
    }),
    db.application.findMany({
      where: { userId, universityId: { in: ids } },
      select: { universityId: true },
    }),
  ]);
  const favorites = new Set(favoriteRows.map((row) => row.universityId));
  const tracked = new Set(trackedRows.map((row) => row.universityId));
  const items = pageRows.map(({ item }) => ({
    ...item,
    isFavorite: favorites.has(item.id),
    isTracked: tracked.has(item.id),
  }));
  return {
    items,
    total,
    page,
    pageCount,
  };
}

export type UniversityDiscoveryDetail = {
  id: string;
  slug: string;
  name: string;
  city: string;
  countryCode: string;
  websiteUrl: string | null;
  continent: string | null;
  institutionType: string | null;
  logoUrl: string | null;
  description: string | null;
  rankingOrganization: string | null;
  rankingEdition: string | null;
  rankingDisplay: string | null;
  rankingPosition: number | null;
  verificationStatus: string;
  lastVerifiedAt: string | null;
  primarySource: ReturnType<typeof citation>;
  fieldFacts: FieldFactDto[];
  isFavorite: boolean;
  isTracked: boolean;
  programs: Array<{
    id: string;
    slug: string;
    name: string;
    degreeLevel: string;
    field: string;
    language: string | null;
    startMonths: number[];
    startNote: string | null;
    lastVerifiedAt: string | null;
    source: ReturnType<typeof citation>;
    tuition: Array<{
      amountMinor: number;
      currency: string;
      period: string;
      applicantGroup: string | null;
      source: ReturnType<typeof citation>;
    }>;
    costs: Array<{
      kind: string;
      amountMinor: number;
      currency: string;
      period: string;
      applicantGroup: string | null;
      note: string | null;
      source: ReturnType<typeof citation>;
    }>;
    requirements: Array<{
      kind: string;
      summary: string;
      source: ReturnType<typeof citation>;
    }>;
    intakes: Array<{
      term: string;
      note: string | null;
      source: ReturnType<typeof citation>;
    }>;
    deadlines: Array<{
      cycle: string;
      deadlineOn: string | null;
      deadlineMonthDay: string | null;
      note: string | null;
      source: ReturnType<typeof citation>;
    }>;
    scholarships: Array<{
      slug: string;
      name: string;
      summary: string;
      featured: boolean;
      source: ReturnType<typeof citation>;
      linkSource: ReturnType<typeof citation>;
    }>;
  }>;
};

export async function getUniversityDiscoveryDetail(
  slug: string,
  userId: string,
): Promise<UniversityDiscoveryDetail | null> {
  const [row, favorite, application] = await Promise.all([
    db.university.findFirst({
      where: { slug, verificationStatus: { in: visibleStatuses } },
      include: discoveryInclude,
    }),
    db.universityFavorite.findFirst({
      where: { userId, university: { slug } },
      select: { id: true },
    }),
    db.application.findFirst({
      where: { userId, university: { slug } },
      select: { id: true },
    }),
  ]);
  if (!row) return null;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    city: row.city,
    countryCode: row.countryCode,
    websiteUrl: row.websiteUrl,
    continent: row.continent,
    institutionType: row.institutionType,
    logoUrl: row.logoUrl,
    description: row.description,
    rankingOrganization: row.rankingOrganization,
    rankingEdition: row.rankingEdition,
    rankingDisplay: row.rankingDisplay,
    rankingPosition: row.rankingPosition,
    verificationStatus: row.verificationStatus,
    lastVerifiedAt: isoDate(row.lastVerifiedAt),
    primarySource: citation(row.primarySource),
    fieldFacts: row.fieldFacts
      .map(toFieldFact)
      .filter((fact): fact is FieldFactDto => fact !== null),
    isFavorite: Boolean(favorite),
    isTracked: Boolean(application),
    programs: row.programs.map((program) => ({
      id: program.id,
      slug: program.slug,
      name: program.name,
      degreeLevel: program.degreeLevel,
      field: program.field,
      language: program.language,
      startMonths: program.startMonths,
      startNote: program.startNote,
      lastVerifiedAt:
        program.lastVerifiedAt?.toISOString().slice(0, 10) ?? null,
      source: citation(program.primarySource),
      tuition: program.tuitionFacts.map((fact) => ({
        amountMinor: fact.amountMinor,
        currency: fact.currency,
        period: fact.period,
        applicantGroup: fact.applicantGroup,
        source: citation(fact.source),
      })),
      costs: program.costs.map((fact) => ({
        kind: fact.kind,
        amountMinor: fact.amountMinor,
        currency: fact.currency,
        period: fact.period,
        applicantGroup: fact.applicantGroup,
        note: fact.note,
        source: citation(fact.source),
      })),
      requirements: program.requirements.map((requirement) => ({
        kind: requirement.kind,
        summary: requirement.summary,
        source: citation(requirement.source),
      })),
      intakes: program.intakes.map((intake) => ({
        term: intake.term,
        note: intake.note,
        source: citation(intake.source),
      })),
      deadlines: program.deadlineFacts.map((deadline) => ({
        cycle: deadline.cycle,
        deadlineOn: deadline.deadlineOn?.toISOString().slice(0, 10) ?? null,
        deadlineMonthDay: deadline.deadlineMonthDay,
        note: deadline.note,
        source: citation(deadline.source),
      })),
      scholarships: program.scholarships.map((link) => ({
        slug: link.scholarship.slug,
        name: link.scholarship.name,
        summary: link.scholarship.summary,
        featured: link.scholarship.featured,
        source: citation(link.scholarship.primarySource),
        linkSource: citation(link.source),
      })),
    })),
  };
}
