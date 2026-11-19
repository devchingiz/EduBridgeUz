import "server-only";

import type { VerificationStatus } from "@prisma/client";

import { recordAuditEvent } from "@/lib/auth/audit";
import {
  VERIFICATION_STATUSES,
  type VerificationStatusValue,
} from "@/lib/catalog/constants";
import { db } from "@/lib/db";

export const ADMIN_UNIVERSITY_PAGE_SIZE = 20;

export const ASSIGNABLE_UNIVERSITY_STATUSES = VERIFICATION_STATUSES;

export type AdminUniversityFilters = {
  query: string;
  status: VerificationStatusValue | null;
  page: number;
};

export type AdminUniversityItem = {
  id: string;
  slug: string;
  name: string;
  city: string;
  countryCode: string;
  status: VerificationStatusValue;
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
      rankingDisplay: true,
      updatedAt: true,
      _count: { select: { programs: true } },
    },
    orderBy: { name: "asc" },
    skip: (page - 1) * ADMIN_UNIVERSITY_PAGE_SIZE,
    take: ADMIN_UNIVERSITY_PAGE_SIZE,
  });

  return {
    items: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      city: row.city,
      countryCode: row.countryCode,
      status: row.verificationStatus,
      rankingDisplay: row.rankingDisplay,
      programCount: row._count.programs,
      updatedAt: row.updatedAt.toISOString().slice(0, 10),
    })),
    total,
    page,
    pageCount,
  };
}

export type StatusChangeResult =
  | { ok: true; changed: boolean; previousStatus: VerificationStatusValue }
  | { ok: false; reason: "not_found" | "invalid_status" | "unchanged" };

/**
 * ADMIN-only status override. Unlike the reviewer workflow this does not claim
 * a source or verification date; it exists to correct catalog state and is
 * always written to the audit trail. Reviewers should use the review queue.
 */
export async function setAdminUniversityStatus(input: {
  actorId: string;
  universityId: string;
  status: VerificationStatusValue;
  ip?: string;
}): Promise<StatusChangeResult> {
  if (!ASSIGNABLE_UNIVERSITY_STATUSES.includes(input.status)) {
    return { ok: false, reason: "invalid_status" };
  }

  const existing = await db.university.findUnique({
    where: { id: input.universityId },
    select: { verificationStatus: true },
  });
  if (!existing) return { ok: false, reason: "not_found" };
  if (existing.verificationStatus === input.status) {
    return { ok: false, reason: "unchanged" };
  }

  await db.university.update({
    where: { id: input.universityId },
    data: { verificationStatus: input.status as VerificationStatus },
  });

  await recordAuditEvent({
    actorId: input.actorId,
    action: "admin.university_status_changed",
    entityType: "UNIVERSITY",
    entityId: input.universityId,
    metadata: {
      fromStatus: existing.verificationStatus,
      toStatus: input.status,
    },
    ip: input.ip,
  });

  return {
    ok: true,
    changed: true,
    previousStatus: existing.verificationStatus,
  };
}
