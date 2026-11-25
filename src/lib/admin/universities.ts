import "server-only";

import {
  isoDayString,
  universityMissingInfo,
} from "@/lib/admin/catalog-management";
import type { VerificationStatusValue } from "@/lib/catalog/constants";
import { db } from "@/lib/db";

export const ADMIN_UNIVERSITY_PAGE_SIZE = 20;

export type AdminUniversityFilters = {
  query: string;
  status: VerificationStatusValue | null;
  featured?: boolean | null;
  page: number;
};

export type AdminUniversityItem = {
  id: string;
  slug: string;
  name: string;
  city: string;
  countryCode: string;
  status: VerificationStatusValue;
  featured: boolean;
  sourceVerifiedAt: string | null;
  warningCount: number;
  rankingDisplay: string | null;
  programCount: number;
  updatedAt: string;
};

export type AdminUniversityList = {
  items: AdminUniversityItem[];
  total: number;
  page: number;
  pageCount: number;
};

export async function listAdminUniversities(
  filters: AdminUniversityFilters,
): Promise<AdminUniversityList> {
  const where = {
    ...(filters.query
      ? {
          OR: [
            { name: { contains: filters.query, mode: "insensitive" as const } },
            { slug: { contains: filters.query, mode: "insensitive" as const } },
            { city: { contains: filters.query, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(filters.status ? { verificationStatus: filters.status } : {}),
    ...(typeof filters.featured === "boolean"
      ? { featured: filters.featured }
      : {}),
  };

  const total = await db.university.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_UNIVERSITY_PAGE_SIZE));
  const page = Math.min(Math.max(filters.page, 1), pageCount);
  const rows = await db.university.findMany({
    where,
    select: {
      id: true,
      slug: true,
      name: true,
      city: true,
      countryCode: true,
      verificationStatus: true,
      featured: true,
      rankingDisplay: true,
      description: true,
      websiteUrl: true,
      continent: true,
      institutionType: true,
      lastVerifiedAt: true,
      nextReviewAt: true,
      updatedAt: true,
      primarySource: { select: { verifiedAt: true } },
      _count: { select: { programs: true } },
    },
    orderBy: [{ featured: "desc" }, { name: "asc" }],
    skip: (page - 1) * ADMIN_UNIVERSITY_PAGE_SIZE,
    take: ADMIN_UNIVERSITY_PAGE_SIZE,
  });

  return {
    items: rows.map((row) => {
      const sourceVerifiedAt = isoDayString(row.primarySource.verifiedAt);
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        city: row.city,
        countryCode: row.countryCode,
        status: row.verificationStatus,
        featured: row.featured,
        sourceVerifiedAt,
        warningCount: universityMissingInfo({
          status: row.verificationStatus,
          sourceVerifiedAt,
          nextReviewAt: isoDayString(row.nextReviewAt),
          websiteUrl: row.websiteUrl,
          description: row.description,
          continent: row.continent,
          institutionType: row.institutionType,
          rankingDisplay: row.rankingDisplay,
          programCount: row._count.programs,
        }).length,
        rankingDisplay: row.rankingDisplay,
        programCount: row._count.programs,
        updatedAt: row.updatedAt.toISOString().slice(0, 10),
      };
    }),
    total,
    page,
    pageCount,
  };
}
