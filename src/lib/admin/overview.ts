import "server-only";

import { db } from "@/lib/db";

/**
 * Read-only operations overview for reviewers and administrators. This is the
 * Milestone 2 RBAC foundation, not a moderation console; every number comes
 * from the database and no student profile content is exposed.
 */
export type AdminOverview = {
  totalUsers: number;
  verifiedUsers: number;
  minorUsers: number;
  pendingGuardianConsents: number;
  activeSessions: number;
  recentEvents: {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    createdAt: Date;
    actorName: string | null;
  }[];
};

export async function getAdminOverview(): Promise<AdminOverview> {
  const now = new Date();
  const minorCutoff = new Date(now);
  minorCutoff.setUTCFullYear(minorCutoff.getUTCFullYear() - 18);

  const [
    totalUsers,
    verifiedUsers,
    minorUsers,
    pendingGuardianConsents,
    activeSessions,
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

  return {
    totalUsers,
    verifiedUsers,
    minorUsers,
    pendingGuardianConsents,
    activeSessions,
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
