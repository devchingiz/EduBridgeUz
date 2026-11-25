import "server-only";

import {
  isoDayString,
  scholarshipMissingInfo,
} from "@/lib/admin/catalog-management";
import type { VerificationStatusValue } from "@/lib/catalog/constants";
import { db } from "@/lib/db";

export const ADMIN_SCHOLARSHIP_PAGE_SIZE = 20;

export type AdminScholarshipFilters = {
  query: string;
  status: VerificationStatusValue | null;
  featured?: boolean | null;
  page: number;
};

export type AdminScholarshipItem = {
  id: string;
  slug: string;
  name: string;
  providerName: string;
  hostCountryCode: string | null;
  fundingType: string;
  status: VerificationStatusValue;
  featured: boolean;
  sourceVerifiedAt: string | null;
  warningCount: number;
  deadlineCount: number;
  updatedAt: string;
};

export type AdminScholarshipList = {
  items: AdminScholarshipItem[];
  total: number;
  page: number;
  pageCount: number;
};

export async function listAdminScholarships(
  filters: AdminScholarshipFilters,
): Promise<AdminScholarshipList> {
  const where = {
    ...(filters.query
      ? {
          OR: [
            { name: { contains: filters.query, mode: "insensitive" as const } },
            { slug: { contains: filters.query, mode: "insensitive" as const } },
            {
              providerName: {
                contains: filters.query,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
    ...(filters.status ? { verificationStatus: filters.status } : {}),
    ...(typeof filters.featured === "boolean"
      ? { featured: filters.featured }
      : {}),
  };

  const total = await db.scholarship.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_SCHOLARSHIP_PAGE_SIZE));
  const page = Math.min(Math.max(filters.page, 1), pageCount);
  const rows = await db.scholarship.findMany({
    where,
    select: {
      id: true,
      slug: true,
      name: true,
      providerName: true,
      hostCountryCode: true,
      fundingType: true,
      verificationStatus: true,
      featured: true,
      summary: true,
      providerUrl: true,
      degreeLevels: true,
      fields: true,
      nationalityScope: true,
      lastVerifiedAt: true,
      nextReviewAt: true,
      updatedAt: true,
      primarySource: { select: { verifiedAt: true } },
      _count: { select: { requirements: true, deadlineFacts: true } },
    },
    orderBy: [{ featured: "desc" }, { name: "asc" }],
    skip: (page - 1) * ADMIN_SCHOLARSHIP_PAGE_SIZE,
    take: ADMIN_SCHOLARSHIP_PAGE_SIZE,
  });

  return {
    items: rows.map((row) => {
      const sourceVerifiedAt = isoDayString(row.primarySource.verifiedAt);
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        providerName: row.providerName,
        hostCountryCode: row.hostCountryCode,
        fundingType: row.fundingType,
        status: row.verificationStatus,
        featured: row.featured,
        sourceVerifiedAt,
        warningCount: scholarshipMissingInfo({
          status: row.verificationStatus,
          sourceVerifiedAt,
          nextReviewAt: isoDayString(row.nextReviewAt),
          summary: row.summary,
          providerUrl: row.providerUrl,
          hostCountryCode: row.hostCountryCode,
          degreeLevels: row.degreeLevels,
          fields: row.fields,
          nationalityScope: row.nationalityScope,
          requirementCount: row._count.requirements,
          deadlineCount: row._count.deadlineFacts,
        }).length,
        deadlineCount: row._count.deadlineFacts,
        updatedAt: row.updatedAt.toISOString().slice(0, 10),
      };
    }),
    total,
    page,
    pageCount,
  };
}
