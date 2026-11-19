import "server-only";

import type { Prisma } from "@prisma/client";

import { isCatalogFavorite } from "@/lib/catalog/favorites";
import { db } from "@/lib/db";
import {
  ALL_FILTER,
  CATALOG_PAGE_SIZE,
  type ScholarshipFilters,
  type UniversityFilters,
} from "@/lib/catalog/filters";
import {
  CATALOG_ENTITY_TYPES,
  PUBLIC_VISIBLE_STATUSES,
  REVIEW_INTERVAL_DAYS,
  nextReviewDate,
  type CatalogEntityTypeValue,
  type VerificationStatusValue,
} from "@/lib/catalog/constants";
import {
  fieldFactSchema,
  programProfileSchema,
  provenanceResponseSchema,
  scholarshipProfileSchema,
  type CitationDto,
  type DeadlineFactDto,
  type FieldFactDto,
  type ProgramProfileDto,
  type ProvenanceDto,
  type ProvenanceResponseDto,
  type RequirementFactDto,
  type ScholarshipProfileDto,
  type TuitionFactDto,
  type UniversityProfileDto,
} from "@/lib/catalog/provenance";
import { logWarn } from "@/lib/observability/logger";

/**
 * Public catalog reads.
 *
 * Every public read is fail-closed: the assembled record is parsed against the
 * provenance schemas before it reaches a page. A record that claims to be
 * verified but has lost its citation returns `null` (and is logged) instead of
 * rendering an unsourced claim.
 */

const citationSelect = {
  id: true,
  url: true,
  publisher: true,
  title: true,
  accessedAt: true,
  verifiedAt: true,
} satisfies Prisma.SourceCitationSelect;

type CitationRow = Prisma.SourceCitationGetPayload<{
  select: typeof citationSelect;
}>;

const factSourceSelect = {
  source: { select: citationSelect },
} satisfies Prisma.RequirementInclude;

function isoDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function toCitation(row: CitationRow): CitationDto {
  return {
    id: row.id,
    url: row.url,
    publisher: row.publisher,
    title: row.title,
    accessedAt: isoDate(row.accessedAt) ?? "",
    verifiedAt: isoDate(row.verifiedAt),
  };
}

function toProvenance(
  status: VerificationStatusValue,
  lastVerifiedAt: Date | null,
  nextReviewAt: Date | null,
  source: CitationRow | null,
): ProvenanceDto {
  return {
    status,
    verifiedAt: isoDate(lastVerifiedAt),
    nextReviewAt: isoDate(nextReviewAt),
    source: source ? toCitation(source) : null,
  };
}

function factProvenance(
  status: VerificationStatusValue,
  source: CitationRow,
  recordNextReviewAt: Date | null,
): ProvenanceDto {
  return {
    status,
    verifiedAt: isoDate(source.verifiedAt),
    nextReviewAt: isoDate(recordNextReviewAt),
    source: toCitation(source),
  };
}

function toFieldFact(row: {
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

const visible = {
  verificationStatus: { in: [...PUBLIC_VISIBLE_STATUSES] },
} satisfies Prisma.UniversityWhereInput;

export type UniversityListItem = {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  city: string;
  countryCode: string;
  websiteUrl: string | null;
  continent: string | null;
  institutionType: string | null;
  logoUrl: string | null;
  description: string | null;
  rankingDisplay: string | null;
  rankingPosition: number | null;
  rankingTied: boolean;
  status: VerificationStatusValue;
  lastVerifiedAt: string | null;
  nextReviewAt: string | null;
  programCount: number;
  degrees: string[];
  fields: string[];
  isFavorite: boolean;
};

export type UniversityListResult = {
  items: UniversityListItem[];
  total: number;
  page: number;
  pageCount: number;
};

export async function listUniversities(
  filters: UniversityFilters,
  userId?: string,
): Promise<UniversityListResult> {
  const programWhere: Prisma.ProgramWhereInput = {
    verificationStatus: { in: [...PUBLIC_VISIBLE_STATUSES] },
    ...(filters.degree !== ALL_FILTER
      ? { degreeLevel: filters.degree as never }
      : {}),
    ...(filters.field !== ALL_FILTER ? { field: filters.field } : {}),
  };

  const where: Prisma.UniversityWhereInput = {
    ...visible,
    ...(filters.country !== ALL_FILTER ? { countryCode: filters.country } : {}),
    ...(filters.continent !== ALL_FILTER
      ? { continent: filters.continent }
      : {}),
    ...(filters.institutionType !== ALL_FILTER
      ? { institutionType: filters.institutionType }
      : {}),
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q, mode: "insensitive" } },
            { shortName: { contains: filters.q, mode: "insensitive" } },
            { city: { contains: filters.q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(filters.degree !== ALL_FILTER || filters.field !== ALL_FILTER
      ? { programs: { some: programWhere } }
      : {}),
  };

  const [total, rows] = await Promise.all([
    db.university.count({ where }),
    db.university.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (filters.page - 1) * CATALOG_PAGE_SIZE,
      take: CATALOG_PAGE_SIZE,
      include: {
        primarySource: { select: citationSelect },
        programs: {
          where: { verificationStatus: { in: [...PUBLIC_VISIBLE_STATUSES] } },
          select: { degreeLevel: true, field: true },
        },
      },
    }),
  ]);

  const favoriteIds = new Set(
    userId && rows.length > 0
      ? (
          await db.universityFavorite.findMany({
            where: {
              userId,
              universityId: { in: rows.map((row) => row.id) },
            },
            select: { universityId: true },
          })
        ).map((favorite) => favorite.universityId)
      : [],
  );

  return {
    items: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      shortName: row.shortName,
      city: row.city,
      countryCode: row.countryCode,
      websiteUrl: row.websiteUrl,
      continent: row.continent,
      institutionType: row.institutionType,
      logoUrl: row.logoUrl,
      description: row.description,
      rankingDisplay: row.rankingDisplay,
      rankingPosition: row.rankingPosition,
      rankingTied: row.rankingTied,
      status: row.verificationStatus,
      lastVerifiedAt: isoDate(row.lastVerifiedAt),
      nextReviewAt: isoDate(row.nextReviewAt),
      programCount: row.programs.length,
      degrees: [...new Set(row.programs.map((program) => program.degreeLevel))],
      fields: [...new Set(row.programs.map((program) => program.field))],
      isFavorite: favoriteIds.has(row.id),
    })),
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE)),
  };
}

export type ProgramListItem = {
  id: string;
  slug: string;
  name: string;
  degreeLevel: string;
  field: string;
  language: string | null;
  durationMonths: number | null;
  credits: number | null;
  status: VerificationStatusValue;
  lastVerifiedAt: string | null;
  nextReviewAt: string | null;
  requirementCount: number;
  tuitionCount: number;
  deadlineCount: number;
};

export type UniversityDetail = {
  university: UniversityProfileDto & {
    isFavorite: boolean;
    continent: string | null;
    institutionType: string | null;
    description: string | null;
    logoUrl: string | null;
    rankingOrganization: string | null;
    rankingEdition: string | null;
    rankingDisplay: string | null;
    rankingPosition: number | null;
    rankingTied: boolean;
    rankingIsRange: boolean;
    fieldFacts: FieldFactDto[];
  };
  programs: ProgramListItem[];
};

export async function getUniversityBySlug(
  slug: string,
  userId?: string,
): Promise<UniversityDetail | null> {
  const row = await db.university.findFirst({
    where: { slug, ...visible },
    include: {
      primarySource: { select: citationSelect },
      programs: {
        where: { verificationStatus: { in: [...PUBLIC_VISIBLE_STATUSES] } },
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: {
              requirements: true,
              tuitionFacts: true,
              deadlineFacts: true,
            },
          },
        },
      },
      fieldFacts: { orderBy: { fieldKey: "asc" } },
    },
  });

  if (!row) return null;
  const isFavorite = await isCatalogFavorite(userId, "UNIVERSITY", row.id);

  const university = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.shortName,
    city: row.city,
    countryCode: row.countryCode,
    websiteUrl: row.websiteUrl,
    continent: row.continent,
    institutionType: row.institutionType,
    description: row.description,
    logoUrl: row.logoUrl,
    rankingOrganization: row.rankingOrganization,
    rankingEdition: row.rankingEdition,
    rankingDisplay: row.rankingDisplay,
    rankingPosition: row.rankingPosition,
    rankingTied: row.rankingTied,
    rankingIsRange: row.rankingIsRange,
    fieldFacts: row.fieldFacts
      .map(toFieldFact)
      .filter((fact): fact is FieldFactDto => fact !== null),
    provenance: toProvenance(
      row.verificationStatus,
      row.lastVerifiedAt,
      row.nextReviewAt,
      row.primarySource,
    ),
  };

  return {
    university: { ...university, isFavorite },
    programs: row.programs.map((program) => ({
      id: program.id,
      slug: program.slug,
      name: program.name,
      degreeLevel: program.degreeLevel,
      field: program.field,
      language: program.language,
      durationMonths: program.durationMonths,
      credits: program.credits,
      status: program.verificationStatus,
      lastVerifiedAt: isoDate(program.lastVerifiedAt),
      nextReviewAt: isoDate(program.nextReviewAt),
      requirementCount: program._count.requirements,
      tuitionCount: program._count.tuitionFacts,
      deadlineCount: program._count.deadlineFacts,
    })),
  };
}

const programDetailInclude = {
  university: { select: { id: true, slug: true, name: true, shortName: true } },
  primarySource: { select: citationSelect },
  requirements: {
    include: factSourceSelect,
    orderBy: { createdAt: "asc" },
  },
  tuitionFacts: {
    include: factSourceSelect,
    orderBy: { amountMinor: "asc" },
  },
  deadlineFacts: {
    include: factSourceSelect,
    orderBy: { deadlineOn: "asc" },
  },
} satisfies Prisma.ProgramInclude;

type ProgramDetailRow = Prisma.ProgramGetPayload<{
  include: typeof programDetailInclude;
}>;

export type ProgramDetail = {
  program: ProgramProfileDto;
  university: {
    id: string;
    slug: string;
    name: string;
    shortName: string | null;
  };
  requirements: RequirementFactDto[];
  tuition: TuitionFactDto[];
  deadlines: DeadlineFactDto[];
};

function mapProgram(row: ProgramDetailRow): ProgramDetail | null {
  const program: ProgramProfileDto = {
    id: row.id,
    universityId: row.universityId,
    slug: row.slug,
    name: row.name,
    degreeLevel: row.degreeLevel,
    field: row.field,
    language: row.language,
    durationMonths: row.durationMonths,
    credits: row.credits,
    startMonths: row.startMonths,
    startNote: row.startNote,
    provenance: toProvenance(
      row.verificationStatus,
      row.lastVerifiedAt,
      row.nextReviewAt,
      row.primarySource,
    ),
    requirements: row.requirements.map((requirement) => ({
      id: requirement.id,
      kind: requirement.kind,
      summary: requirement.summary,
      provenance: factProvenance(
        requirement.verificationStatus,
        requirement.source,
        row.nextReviewAt,
      ),
    })),
    tuition: row.tuitionFacts.map((fact) => ({
      id: fact.id,
      amountMinor: fact.amountMinor,
      currency: fact.currency,
      period: fact.period,
      applicantGroup: fact.applicantGroup,
      note: fact.note,
      provenance: factProvenance(
        fact.verificationStatus,
        fact.source,
        row.nextReviewAt,
      ),
    })),
    deadlines: row.deadlineFacts.map((fact) => ({
      id: fact.id,
      cycle: fact.cycle,
      applicantGroup: fact.applicantGroup,
      opensOn: isoDate(fact.opensOn),
      deadlineOn: isoDate(fact.deadlineOn),
      opensMonthDay: fact.opensMonthDay,
      deadlineMonthDay: fact.deadlineMonthDay,
      note: fact.note,
      provenance: factProvenance(
        fact.verificationStatus,
        fact.source,
        row.nextReviewAt,
      ),
    })),
  };

  const parsed = programProfileSchema.safeParse(program);
  if (!parsed.success) {
    logWarn("catalog.record_invalid", { entityType: "program" });
    return null;
  }

  return {
    program: parsed.data,
    university: row.university,
    requirements: program.requirements,
    tuition: program.tuition,
    deadlines: program.deadlines,
  };
}

export async function getProgramDetail(
  universitySlug: string,
  programSlug: string,
): Promise<ProgramDetail | null> {
  const row = await db.program.findFirst({
    where: {
      slug: programSlug,
      verificationStatus: { in: [...PUBLIC_VISIBLE_STATUSES] },
      university: { slug: universitySlug, ...visible },
    },
    include: programDetailInclude,
  });

  return row ? mapProgram(row) : null;
}

const scholarshipDetailInclude = {
  primarySource: { select: citationSelect },
  requirements: {
    include: factSourceSelect,
    orderBy: { createdAt: "asc" },
  },
  deadlineFacts: {
    include: factSourceSelect,
    orderBy: { deadlineOn: "asc" },
  },
} satisfies Prisma.ScholarshipInclude;

type ScholarshipDetailRow = Prisma.ScholarshipGetPayload<{
  include: typeof scholarshipDetailInclude;
}>;

export type ScholarshipListItem = {
  id: string;
  slug: string;
  name: string;
  providerName: string;
  providerUrl: string;
  hostCountryCode: string | null;
  fundingType: string;
  degreeLevels: string[];
  nationalityScope: string;
  eligibleNationalities: string[];
  fieldScope: string;
  fields: string[];
  summary: string;
  status: VerificationStatusValue;
  lastVerifiedAt: string | null;
  nextReviewAt: string | null;
  deadlineCount: number;
  isFavorite: boolean;
};

export type ScholarshipListResult = {
  items: ScholarshipListItem[];
  total: number;
  page: number;
  pageCount: number;
};

export async function listScholarships(
  filters: ScholarshipFilters,
  userId?: string,
): Promise<ScholarshipListResult> {
  const where: Prisma.ScholarshipWhereInput = {
    verificationStatus: { in: [...PUBLIC_VISIBLE_STATUSES] },
    ...(filters.hostCountry !== ALL_FILTER
      ? { hostCountryCode: filters.hostCountry }
      : {}),
    ...(filters.funding !== ALL_FILTER
      ? { fundingType: filters.funding as never }
      : {}),
    ...(filters.degree !== ALL_FILTER
      ? { degreeLevels: { has: filters.degree as never } }
      : {}),
    ...(filters.field !== ALL_FILTER ? { fields: { has: filters.field } } : {}),
    ...(filters.nationality !== ALL_FILTER
      ? {
          OR: [
            { nationalityScope: "ALL" },
            { eligibleNationalities: { has: filters.nationality } },
          ],
        }
      : {}),
    ...(filters.q
      ? {
          AND: [
            {
              OR: [
                { name: { contains: filters.q, mode: "insensitive" } },
                { providerName: { contains: filters.q, mode: "insensitive" } },
                { summary: { contains: filters.q, mode: "insensitive" } },
              ],
            },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    db.scholarship.count({ where }),
    db.scholarship.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (filters.page - 1) * CATALOG_PAGE_SIZE,
      take: CATALOG_PAGE_SIZE,
      include: {
        _count: { select: { deadlineFacts: true } },
      },
    }),
  ]);

  const favoriteIds = new Set(
    userId && rows.length > 0
      ? (
          await db.scholarshipFavorite.findMany({
            where: {
              userId,
              scholarshipId: { in: rows.map((row) => row.id) },
            },
            select: { scholarshipId: true },
          })
        ).map((favorite) => favorite.scholarshipId)
      : [],
  );

  return {
    items: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      providerName: row.providerName,
      providerUrl: row.providerUrl,
      hostCountryCode: row.hostCountryCode,
      fundingType: row.fundingType,
      degreeLevels: row.degreeLevels,
      nationalityScope: row.nationalityScope,
      eligibleNationalities: row.eligibleNationalities,
      fieldScope: row.fieldScope,
      fields: row.fields,
      summary: row.summary,
      status: row.verificationStatus,
      lastVerifiedAt: isoDate(row.lastVerifiedAt),
      nextReviewAt: isoDate(row.nextReviewAt),
      deadlineCount: row._count.deadlineFacts,
      isFavorite: favoriteIds.has(row.id),
    })),
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE)),
  };
}

export type ScholarshipDetail = {
  scholarship: ScholarshipProfileDto;
  requirements: RequirementFactDto[];
  deadlines: DeadlineFactDto[];
  isFavorite: boolean;
};

function mapScholarship(row: ScholarshipDetailRow): ScholarshipDetail | null {
  const scholarship: ScholarshipProfileDto = {
    id: row.id,
    slug: row.slug,
    name: row.name,
    providerName: row.providerName,
    providerUrl: row.providerUrl,
    hostCountryCode: row.hostCountryCode,
    fundingType: row.fundingType,
    degreeLevels: row.degreeLevels,
    nationalityScope: row.nationalityScope,
    eligibleNationalities: row.eligibleNationalities,
    fieldScope: row.fieldScope,
    fields: row.fields,
    summary: row.summary,
    provenance: toProvenance(
      row.verificationStatus,
      row.lastVerifiedAt,
      row.nextReviewAt,
      row.primarySource,
    ),
    requirements: row.requirements.map((requirement) => ({
      id: requirement.id,
      kind: requirement.kind,
      summary: requirement.summary,
      provenance: factProvenance(
        requirement.verificationStatus,
        requirement.source,
        row.nextReviewAt,
      ),
    })),
    deadlines: row.deadlineFacts.map((fact) => ({
      id: fact.id,
      cycle: fact.cycle,
      applicantGroup: fact.applicantGroup,
      opensOn: isoDate(fact.opensOn),
      deadlineOn: isoDate(fact.deadlineOn),
      opensMonthDay: fact.opensMonthDay,
      deadlineMonthDay: fact.deadlineMonthDay,
      note: fact.note,
      provenance: factProvenance(
        fact.verificationStatus,
        fact.source,
        row.nextReviewAt,
      ),
    })),
  };

  const parsed = scholarshipProfileSchema.safeParse(scholarship);
  if (!parsed.success) {
    logWarn("catalog.record_invalid", { entityType: "scholarship" });
    return null;
  }

  return {
    scholarship: parsed.data,
    requirements: scholarship.requirements,
    deadlines: scholarship.deadlines,
    isFavorite: false,
  };
}

export async function getScholarshipBySlug(
  slug: string,
  userId?: string,
): Promise<ScholarshipDetail | null> {
  const row = await db.scholarship.findFirst({
    where: {
      slug,
      verificationStatus: { in: [...PUBLIC_VISIBLE_STATUSES] },
    },
    include: scholarshipDetailInclude,
  });

  if (!row) return null;
  const detail = mapScholarship(row);
  if (!detail) return null;
  const isFavorite = await isCatalogFavorite(userId, "SCHOLARSHIP", row.id);
  return { ...detail, isFavorite };
}

export type CatalogOptions = {
  universityCountries: string[];
  scholarshipHostCountries: string[];
};

export async function getCatalogOptions(): Promise<CatalogOptions> {
  const [universities, scholarships] = await Promise.all([
    db.university.findMany({
      where: visible,
      distinct: ["countryCode"],
      select: { countryCode: true },
      orderBy: { countryCode: "asc" },
    }),
    db.scholarship.findMany({
      where: {
        verificationStatus: { in: [...PUBLIC_VISIBLE_STATUSES] },
        hostCountryCode: { not: null },
      },
      distinct: ["hostCountryCode"],
      select: { hostCountryCode: true },
      orderBy: { hostCountryCode: "asc" },
    }),
  ]);

  return {
    universityCountries: universities.map((row) => row.countryCode),
    scholarshipHostCountries: scholarships
      .map((row) => row.hostCountryCode)
      .filter((code): code is string => Boolean(code)),
  };
}

// ---------------------------------------------------------------------------
// Reviewer reads
// ---------------------------------------------------------------------------

export type ReviewItem = {
  entityType: CatalogEntityTypeValue;
  id: string;
  name: string;
  slug: string;
  status: VerificationStatusValue;
  lastVerifiedAt: string | null;
  nextReviewAt: string | null;
  context: string | null;
};

export type ReviewEvent = {
  id: string;
  entityType: string;
  entityId: string;
  decision: string;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  createdAt: string;
  reviewerName: string | null;
};

export type ReviewQueue = {
  items: ReviewItem[];
  recentReviews: ReviewEvent[];
  counts: {
    needsReview: number;
    partiallyVerified: number;
    unverified: number;
    expired: number;
    citationsWithoutVerification: number;
  };
};

export async function getReviewQueue(): Promise<ReviewQueue> {
  const attention = {
    in: [
      "NEEDS_REVIEW",
      "PARTIALLY_VERIFIED",
      "UNVERIFIED",
      "EXPIRED",
    ] as VerificationStatusValue[],
  };

  const [
    universities,
    programs,
    scholarships,
    needsReview,
    partiallyVerified,
    unverified,
    expired,
    citationsWithoutVerification,
    recentReviews,
  ] = await Promise.all([
    db.university.findMany({
      where: { verificationStatus: attention },
      select: {
        id: true,
        slug: true,
        name: true,
        verificationStatus: true,
        lastVerifiedAt: true,
        nextReviewAt: true,
        city: true,
        countryCode: true,
      },
      orderBy: { updatedAt: "asc" },
      take: 20,
    }),
    db.program.findMany({
      where: { verificationStatus: attention },
      select: {
        id: true,
        slug: true,
        name: true,
        verificationStatus: true,
        lastVerifiedAt: true,
        nextReviewAt: true,
        university: { select: { name: true } },
      },
      orderBy: { updatedAt: "asc" },
      take: 20,
    }),
    db.scholarship.findMany({
      where: { verificationStatus: attention },
      select: {
        id: true,
        slug: true,
        name: true,
        verificationStatus: true,
        lastVerifiedAt: true,
        nextReviewAt: true,
        providerName: true,
      },
      orderBy: { updatedAt: "asc" },
      take: 20,
    }),
    db.university.count({ where: { verificationStatus: "NEEDS_REVIEW" } }),
    db.university.count({
      where: { verificationStatus: "PARTIALLY_VERIFIED" },
    }),
    db.university.count({ where: { verificationStatus: "UNVERIFIED" } }),
    db.university.count({ where: { verificationStatus: "EXPIRED" } }),
    db.sourceCitation.count({ where: { verifiedAt: null } }),
    db.catalogReview.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { reviewer: { select: { name: true } } },
    }),
  ]);

  const items: ReviewItem[] = [
    ...universities.map((row) => ({
      entityType: "UNIVERSITY" as const,
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.verificationStatus,
      lastVerifiedAt: isoDate(row.lastVerifiedAt),
      nextReviewAt: isoDate(row.nextReviewAt),
      context: `${row.city}, ${row.countryCode}`,
    })),
    ...programs.map((row) => ({
      entityType: "PROGRAM" as const,
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.verificationStatus,
      lastVerifiedAt: isoDate(row.lastVerifiedAt),
      nextReviewAt: isoDate(row.nextReviewAt),
      context: row.university.name,
    })),
    ...scholarships.map((row) => ({
      entityType: "SCHOLARSHIP" as const,
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.verificationStatus,
      lastVerifiedAt: isoDate(row.lastVerifiedAt),
      nextReviewAt: isoDate(row.nextReviewAt),
      context: row.providerName,
    })),
  ];

  return {
    items,
    recentReviews: recentReviews.map((review) => ({
      id: review.id,
      entityType: review.entityType,
      entityId: review.entityId,
      decision: review.decision,
      fromStatus: review.fromStatus,
      toStatus: review.toStatus,
      note: review.note,
      createdAt: review.createdAt.toISOString(),
      reviewerName: review.reviewer?.name ?? null,
    })),
    counts: {
      needsReview,
      partiallyVerified,
      unverified,
      expired,
      citationsWithoutVerification,
    },
  };
}

/**
 * Every catalog record, newest update first. The review queue only lists
 * records that need attention, so this is how a reviewer opens a record that is
 * already verified in order to re-check or edit it.
 */
export async function listReviewRecords(limit = 50): Promise<ReviewItem[]> {
  const [universities, programs, scholarships] = await Promise.all([
    db.university.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        verificationStatus: true,
        lastVerifiedAt: true,
        nextReviewAt: true,
        city: true,
        countryCode: true,
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    }),
    db.program.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        verificationStatus: true,
        lastVerifiedAt: true,
        nextReviewAt: true,
        university: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    }),
    db.scholarship.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        verificationStatus: true,
        lastVerifiedAt: true,
        nextReviewAt: true,
        providerName: true,
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    }),
  ]);

  return [
    ...universities.map((row) => ({
      entityType: "UNIVERSITY" as const,
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.verificationStatus,
      lastVerifiedAt: isoDate(row.lastVerifiedAt),
      nextReviewAt: isoDate(row.nextReviewAt),
      context: `${row.city}, ${row.countryCode}`,
    })),
    ...programs.map((row) => ({
      entityType: "PROGRAM" as const,
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.verificationStatus,
      lastVerifiedAt: isoDate(row.lastVerifiedAt),
      nextReviewAt: isoDate(row.nextReviewAt),
      context: row.university.name,
    })),
    ...scholarships.map((row) => ({
      entityType: "SCHOLARSHIP" as const,
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.verificationStatus,
      lastVerifiedAt: isoDate(row.lastVerifiedAt),
      nextReviewAt: isoDate(row.nextReviewAt),
      context: row.providerName,
    })),
  ].sort((a, b) => a.name.localeCompare(b.name));
}

export type ReviewRecord = {
  entityType: CatalogEntityTypeValue;
  id: string;
  name: string;
  slug: string;
  status: VerificationStatusValue;
  lastVerifiedAt: string | null;
  nextReviewAt: string | null;
  source: CitationDto | null;
  /** Entity-specific defaults for the edit form. */
  fields: Record<string, string>;
  programs?: { id: string; name: string; slug: string }[];
  requirements: {
    id: string;
    kind: string;
    summary: string;
    status: VerificationStatusValue;
    verifiedAt: string | null;
    sourceUrl: string;
  }[];
  tuition: {
    id: string;
    amount: string;
    currency: string;
    period: string;
    applicantGroup: string;
    note: string;
  }[];
  deadlines: {
    id: string;
    cycle: string;
    applicantGroup: string;
    opensOn: string;
    deadlineOn: string;
    opensMonthDay: string;
    deadlineMonthDay: string;
    note: string;
  }[];
};

export async function listUniversityOptions(): Promise<
  { id: string; name: string }[]
> {
  return db.university.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getReviewRecord(
  entityType: CatalogEntityTypeValue,
  id: string,
): Promise<ReviewRecord | null> {
  if (entityType === "UNIVERSITY") {
    const row = await db.university.findUnique({
      where: { id },
      include: { primarySource: { select: citationSelect } },
    });
    if (!row) return null;
    return {
      entityType,
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.verificationStatus,
      lastVerifiedAt: isoDate(row.lastVerifiedAt),
      nextReviewAt: isoDate(row.nextReviewAt),
      source: row.primarySource ? toCitation(row.primarySource) : null,
      fields: {
        name: row.name,
        shortName: row.shortName ?? "",
        city: row.city,
        countryCode: row.countryCode,
        websiteUrl: row.websiteUrl ?? "",
      },
      requirements: [],
      tuition: [],
      deadlines: [],
    };
  }

  if (entityType === "PROGRAM") {
    const row = await db.program.findUnique({
      where: { id },
      include: {
        primarySource: { select: citationSelect },
        university: { select: { id: true, name: true, slug: true } },
        requirements: {
          include: { source: { select: citationSelect } },
          orderBy: { createdAt: "asc" },
        },
        tuitionFacts: { orderBy: { amountMinor: "asc" } },
        deadlineFacts: { orderBy: { deadlineOn: "asc" } },
      },
    });
    if (!row) return null;
    return {
      entityType,
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.verificationStatus,
      lastVerifiedAt: isoDate(row.lastVerifiedAt),
      nextReviewAt: isoDate(row.nextReviewAt),
      source: row.primarySource ? toCitation(row.primarySource) : null,
      fields: {
        name: row.name,
        slug: row.slug,
        degreeLevel: row.degreeLevel,
        field: row.field,
        language: row.language ?? "",
        durationMonths: row.durationMonths ? String(row.durationMonths) : "",
        credits: row.credits ? String(row.credits) : "",
        startNote: row.startNote ?? "",
        universityId: row.universityId,
      },
      programs: [row.university],
      requirements: row.requirements.map((requirement) => ({
        id: requirement.id,
        kind: requirement.kind,
        summary: requirement.summary,
        status: requirement.verificationStatus,
        verifiedAt: isoDate(requirement.source.verifiedAt),
        sourceUrl: requirement.source.url,
      })),
      tuition: row.tuitionFacts.map((fact) => ({
        id: fact.id,
        amount: (fact.amountMinor / 100).toFixed(2),
        currency: fact.currency,
        period: fact.period,
        applicantGroup: fact.applicantGroup ?? "",
        note: fact.note ?? "",
      })),
      deadlines: row.deadlineFacts.map((fact) => ({
        id: fact.id,
        cycle: fact.cycle,
        applicantGroup: fact.applicantGroup ?? "",
        opensOn: isoDate(fact.opensOn) ?? "",
        deadlineOn: isoDate(fact.deadlineOn) ?? "",
        opensMonthDay: fact.opensMonthDay ?? "",
        deadlineMonthDay: fact.deadlineMonthDay ?? "",
        note: fact.note ?? "",
      })),
    };
  }

  const row = await db.scholarship.findUnique({
    where: { id },
    include: {
      primarySource: { select: citationSelect },
      requirements: {
        include: { source: { select: citationSelect } },
        orderBy: { createdAt: "asc" },
      },
      deadlineFacts: { orderBy: { deadlineOn: "asc" } },
    },
  });
  if (!row) return null;
  return {
    entityType,
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.verificationStatus,
    lastVerifiedAt: isoDate(row.lastVerifiedAt),
    nextReviewAt: isoDate(row.nextReviewAt),
    source: row.primarySource ? toCitation(row.primarySource) : null,
    fields: {
      name: row.name,
      slug: row.slug,
      providerName: row.providerName,
      providerUrl: row.providerUrl,
      hostCountryCode: row.hostCountryCode ?? "",
      fundingType: row.fundingType,
      degreeLevels: row.degreeLevels.join(","),
      nationalityScope: row.nationalityScope,
      eligibleNationalities: row.eligibleNationalities.join(","),
      fieldScope: row.fieldScope,
      fields: row.fields.join(", "),
      summary: row.summary,
    },
    requirements: row.requirements.map((requirement) => ({
      id: requirement.id,
      kind: requirement.kind,
      summary: requirement.summary,
      status: requirement.verificationStatus,
      verifiedAt: isoDate(requirement.source.verifiedAt),
      sourceUrl: requirement.source.url,
    })),
    tuition: [],
    deadlines: row.deadlineFacts.map((fact) => ({
      id: fact.id,
      cycle: fact.cycle,
      applicantGroup: fact.applicantGroup ?? "",
      opensOn: isoDate(fact.opensOn) ?? "",
      deadlineOn: isoDate(fact.deadlineOn) ?? "",
      opensMonthDay: fact.opensMonthDay ?? "",
      deadlineMonthDay: fact.deadlineMonthDay ?? "",
      note: fact.note ?? "",
    })),
  };
}

export async function getEntityReviews(
  entityType: CatalogEntityTypeValue,
  entityId: string,
): Promise<ReviewEvent[]> {
  const rows = await db.catalogReview.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: { reviewer: { select: { name: true } } },
  });

  return rows.map((review) => ({
    id: review.id,
    entityType: review.entityType,
    entityId: review.entityId,
    decision: review.decision,
    fromStatus: review.fromStatus,
    toStatus: review.toStatus,
    note: review.note,
    createdAt: review.createdAt.toISOString(),
    reviewerName: review.reviewer?.name ?? null,
  }));
}

export type DataQualityReport = {
  generatedAt: string;
  statusCounts: Record<
    CatalogEntityTypeValue,
    Record<VerificationStatusValue, number>
  >;
  verifiedRecords: number;
  recordsWithExpiredReview: number;
  factsWithoutVerifiedSource: number;
  citationsWithoutVerification: number;
  coverage: { countryCode: string; universities: number; programs: number }[];
  lastReview: ReviewEvent | null;
};

export async function getDataQualityReport(): Promise<DataQualityReport> {
  const now = new Date();
  const [
    universityGroups,
    programGroups,
    scholarshipGroups,
    expiredUniversities,
    expiredPrograms,
    expiredScholarships,
    factsWithoutVerifiedSource,
    citationsWithoutVerification,
    countries,
    lastReview,
  ] = await Promise.all([
    db.university.groupBy({
      by: ["verificationStatus"],
      _count: { _all: true },
    }),
    db.program.groupBy({
      by: ["verificationStatus"],
      _count: { _all: true },
    }),
    db.scholarship.groupBy({
      by: ["verificationStatus"],
      _count: { _all: true },
    }),
    db.university.count({
      where: {
        verificationStatus: "VERIFIED",
        nextReviewAt: { lt: now },
      },
    }),
    db.program.count({
      where: {
        verificationStatus: "VERIFIED",
        nextReviewAt: { lt: now },
      },
    }),
    db.scholarship.count({
      where: {
        verificationStatus: "VERIFIED",
        nextReviewAt: { lt: now },
      },
    }),
    db.requirement.count({
      where: {
        verificationStatus: "VERIFIED",
        source: { verifiedAt: null },
      },
    }),
    db.sourceCitation.count({ where: { verifiedAt: null } }),
    db.university.findMany({
      where: { verificationStatus: { in: [...PUBLIC_VISIBLE_STATUSES] } },
      select: {
        countryCode: true,
        _count: { select: { programs: true } },
      },
    }),
    db.catalogReview.findFirst({
      orderBy: { createdAt: "desc" },
      include: { reviewer: { select: { name: true } } },
    }),
  ]);

  const emptyStatusCounts = (): Record<VerificationStatusValue, number> => ({
    VERIFIED: 0,
    PARTIALLY_VERIFIED: 0,
    INFORMATION_UNAVAILABLE: 0,
    NEEDS_REVIEW: 0,
    UNVERIFIED: 0,
    EXPIRED: 0,
    ARCHIVED: 0,
  });

  const toCounts = (
    groups: {
      verificationStatus: VerificationStatusValue;
      _count: { _all: number };
    }[],
  ) => {
    const counts = emptyStatusCounts();
    for (const group of groups)
      counts[group.verificationStatus] = group._count._all;
    return counts;
  };

  const universityCounts = toCounts(universityGroups);
  const programCounts = toCounts(programGroups);
  const scholarshipCounts = toCounts(scholarshipGroups);

  const coverageMap = new Map<
    string,
    { universities: number; programs: number }
  >();
  for (const row of countries) {
    const current = coverageMap.get(row.countryCode) ?? {
      universities: 0,
      programs: 0,
    };
    current.universities += 1;
    current.programs += row._count.programs;
    coverageMap.set(row.countryCode, current);
  }

  return {
    generatedAt: now.toISOString(),
    statusCounts: {
      UNIVERSITY: universityCounts,
      PROGRAM: programCounts,
      SCHOLARSHIP: scholarshipCounts,
    },
    verifiedRecords:
      universityCounts.VERIFIED +
      programCounts.VERIFIED +
      scholarshipCounts.VERIFIED,
    recordsWithExpiredReview:
      expiredUniversities + expiredPrograms + expiredScholarships,
    factsWithoutVerifiedSource,
    citationsWithoutVerification,
    coverage: [...coverageMap.entries()]
      .map(([countryCode, counts]) => ({ countryCode, ...counts }))
      .sort((a, b) => a.countryCode.localeCompare(b.countryCode)),
    lastReview: lastReview
      ? {
          id: lastReview.id,
          entityType: lastReview.entityType,
          entityId: lastReview.entityId,
          decision: lastReview.decision,
          fromStatus: lastReview.fromStatus,
          toStatus: lastReview.toStatus,
          note: lastReview.note,
          createdAt: lastReview.createdAt.toISOString(),
          reviewerName: lastReview.reviewer?.name ?? null,
        }
      : null,
  };
}

/**
 * Builds the serialised provenance response for a record. Used by the reviewer
 * record page and by the provenance contract tests.
 */
export async function getProvenanceResponse(
  entityType: CatalogEntityTypeValue,
  id: string,
): Promise<ProvenanceResponseDto | null> {
  if (!CATALOG_ENTITY_TYPES.includes(entityType)) return null;

  if (entityType === "PROGRAM") {
    const row = await db.program.findUnique({
      where: { id },
      include: programDetailInclude,
    });
    if (!row) return null;
    const detail = mapProgram(row);
    if (!detail) return null;
    const { program } = detail;
    const response = {
      entity: {
        id: program.id,
        type: entityType,
        slug: program.slug,
        name: program.name,
      },
      status: program.provenance.status,
      lastVerifiedAt: program.provenance.verifiedAt,
      nextReviewAt: program.provenance.nextReviewAt,
      sources: [
        program.provenance.source,
        ...program.requirements.map((fact) => fact.provenance.source),
        ...program.tuition.map((fact) => fact.provenance.source),
        ...program.deadlines.map((fact) => fact.provenance.source),
      ].filter((source): source is CitationDto => Boolean(source)),
      facts: [
        ...program.requirements.map((fact) => ({
          key: `requirement.${fact.id}`,
          label: fact.kind,
          value: fact.summary,
          provenance: fact.provenance,
        })),
        ...program.tuition.map((fact) => ({
          key: `tuition.${fact.id}`,
          label: fact.applicantGroup ?? "Tuition",
          value: `${fact.amountMinor} ${fact.currency} ${fact.period}`,
          provenance: fact.provenance,
        })),
        ...program.deadlines.map((fact) => ({
          key: `deadline.${fact.id}`,
          label: fact.applicantGroup ?? fact.cycle,
          value: fact.note ?? fact.deadlineOn ?? fact.deadlineMonthDay ?? "",
          provenance: fact.provenance,
        })),
      ],
    };
    const parsed = provenanceResponseSchema.safeParse(response);
    return parsed.success ? parsed.data : null;
  }

  if (entityType === "SCHOLARSHIP") {
    const row = await db.scholarship.findUnique({
      where: { id },
      include: scholarshipDetailInclude,
    });
    if (!row) return null;
    const detail = mapScholarship(row);
    if (!detail) return null;
    const { scholarship } = detail;
    const response = {
      entity: {
        id: scholarship.id,
        type: entityType,
        slug: scholarship.slug,
        name: scholarship.name,
      },
      status: scholarship.provenance.status,
      lastVerifiedAt: scholarship.provenance.verifiedAt,
      nextReviewAt: scholarship.provenance.nextReviewAt,
      sources: [
        scholarship.provenance.source,
        ...scholarship.requirements.map((fact) => fact.provenance.source),
        ...scholarship.deadlines.map((fact) => fact.provenance.source),
      ].filter((source): source is CitationDto => Boolean(source)),
      facts: [
        ...scholarship.requirements.map((fact) => ({
          key: `requirement.${fact.id}`,
          label: fact.kind,
          value: fact.summary,
          provenance: fact.provenance,
        })),
        ...scholarship.deadlines.map((fact) => ({
          key: `deadline.${fact.id}`,
          label: fact.applicantGroup ?? fact.cycle,
          value: fact.note ?? fact.deadlineOn ?? fact.deadlineMonthDay ?? "",
          provenance: fact.provenance,
        })),
      ],
    };
    const parsed = provenanceResponseSchema.safeParse(response);
    return parsed.success ? parsed.data : null;
  }

  const row = await db.university.findUnique({
    where: { id },
    include: { primarySource: { select: citationSelect } },
  });
  if (!row) return null;
  const response = {
    entity: {
      id: row.id,
      type: entityType,
      slug: row.slug,
      name: row.name,
    },
    status: row.verificationStatus,
    lastVerifiedAt: isoDate(row.lastVerifiedAt),
    nextReviewAt: isoDate(row.nextReviewAt),
    sources: row.primarySource ? [toCitation(row.primarySource)] : [],
    facts: [],
  };
  const parsed = provenanceResponseSchema.safeParse(response);
  return parsed.success ? parsed.data : null;
}

/** Used by the expiry sweep and the data-quality page. */
export function reviewDueBefore(days = REVIEW_INTERVAL_DAYS): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

export function scheduleNextReview(from: Date): Date {
  return nextReviewDate(from);
}
