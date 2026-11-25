import "server-only";

import type { ApplicationStatus, VerificationStatus } from "@prisma/client";

import {
  applicationStatusBreakdown,
  buildTrend,
  scholarshipStatusBreakdown,
  TREND_DAYS,
  universityStatusBreakdown,
  type StatusBreakdownItem,
  type TrendPoint,
} from "@/lib/admin/analytics";
import { getDataQualityReport } from "@/lib/catalog/queries";
import { db } from "@/lib/db";

/**
 * Read-only operations overview for the administration panel. Every number is
 * computed from live database rows on each request; nothing is cached and no
 * student content, document bytes, or conversation text is exposed.
 */
export type AdminOverview = {
  totalUsers: number;
  verifiedUsers: number;
  minorUsers: number;
  pendingGuardianConsents: number;
  activeSessions: number;
  totals: {
    universities: number;
    scholarships: number;
    programs: number;
    applications: number;
    advisorConversations: number;
    advisorRequests: number;
    estimatedAdvisorCostUsd: number;
  };
  catalogHealth: {
    verifiedRecords: number;
    recordsWithExpiredReview: number;
    citationsWithoutVerification: number;
  };
  trend: TrendPoint[];
  universityStatuses: StatusBreakdownItem<VerificationStatus>[];
  scholarshipStatuses: StatusBreakdownItem<VerificationStatus>[];
  applicationStatuses: StatusBreakdownItem<ApplicationStatus>[];
  generatedAt: string;
  recentEvents: {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    createdAt: Date;
    actorName: string | null;
  }[];
};

function sumStatusCounts(counts: Record<string, number>): number {
  return Object.values(counts).reduce((total, count) => total + count, 0);
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const now = new Date();
  const minorCutoff = new Date(now);
  minorCutoff.setUTCFullYear(minorCutoff.getUTCFullYear() - 18);
  const trendStart = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - (TREND_DAYS - 1),
    ),
  );

  const [
    totalUsers,
    verifiedUsers,
    minorUsers,
    pendingGuardianConsents,
    activeSessions,
    quality,
    applicationGroups,
    advisorConversations,
    advisorUsage,
    userTimestamps,
    applicationTimestamps,
    auditTimestamps,
    advisorTimestamps,
    recentEvents,
  ] = await Promise.all([
    db.user.count({ where: { deletedAt: null } }),
    db.user.count({
      where: { deletedAt: null, emailVerifiedAt: { not: null } },
    }),
    db.user.count({
      where: { deletedAt: null, dateOfBirth: { gt: minorCutoff } },
    }),
    db.studentProfile.count({
      where: {
        guardianConsentAt: null,
        guardianEmail: { not: null },
        user: { deletedAt: null, dateOfBirth: { gt: minorCutoff } },
      },
    }),
    db.session.count({
      where: { revokedAt: null, expiresAt: { gt: now } },
    }),
    getDataQualityReport(),
    db.application.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    db.advisorConversation.count(),
    db.advisorUsage.aggregate({
      _count: { _all: true },
      _sum: { estimatedCostMicros: true },
    }),
    db.user.findMany({
      where: { createdAt: { gte: trendStart } },
      select: { createdAt: true },
    }),
    db.application.findMany({
      where: { createdAt: { gte: trendStart } },
      select: { createdAt: true },
    }),
    db.auditEvent.findMany({
      where: { createdAt: { gte: trendStart } },
      select: { createdAt: true },
    }),
    db.advisorUsage.findMany({
      where: { createdAt: { gte: trendStart } },
      select: { createdAt: true },
    }),
    db.auditEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        actor: { select: { name: true } },
      },
    }),
  ]);

  const applicationCounts = Object.fromEntries(
    applicationGroups.map((group) => [group.status, group._count._all]),
  ) as Partial<Record<ApplicationStatus, number>>;
  const costMicros = advisorUsage._sum.estimatedCostMicros ?? 0;

  return {
    totalUsers,
    verifiedUsers,
    minorUsers,
    pendingGuardianConsents,
    activeSessions,
    totals: {
      universities: sumStatusCounts(quality.statusCounts.UNIVERSITY),
      scholarships: sumStatusCounts(quality.statusCounts.SCHOLARSHIP),
      programs: sumStatusCounts(quality.statusCounts.PROGRAM),
      applications: applicationGroups.reduce(
        (total, group) => total + group._count._all,
        0,
      ),
      advisorConversations,
      advisorRequests: advisorUsage._count._all,
      estimatedAdvisorCostUsd: Math.round(costMicros / 10_000) / 100,
    },
    catalogHealth: {
      verifiedRecords: quality.verifiedRecords,
      recordsWithExpiredReview: quality.recordsWithExpiredReview,
      citationsWithoutVerification: quality.citationsWithoutVerification,
    },
    trend: buildTrend(
      {
        accounts: userTimestamps.map((row) => row.createdAt),
        applications: applicationTimestamps.map((row) => row.createdAt),
        auditEvents: auditTimestamps.map((row) => row.createdAt),
        advisorRequests: advisorTimestamps.map((row) => row.createdAt),
      },
      now,
    ),
    universityStatuses: universityStatusBreakdown(
      quality.statusCounts.UNIVERSITY,
    ),
    scholarshipStatuses: scholarshipStatusBreakdown(
      quality.statusCounts.SCHOLARSHIP,
    ),
    applicationStatuses: applicationStatusBreakdown(applicationCounts),
    generatedAt: now.toISOString(),
    recentEvents: recentEvents.map((event) => ({
      id: event.id,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      createdAt: event.createdAt,
      actorName: event.actor?.name ?? null,
    })),
  };
}
