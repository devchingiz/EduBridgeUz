import "server-only";

import type { Prisma, Role } from "@prisma/client";

import { db } from "@/lib/db";
import { recordAuditEvent } from "@/lib/auth/audit";

/**
 * Administrator-only user management. Every function receives an actor ID and
 * re-reads that actor's role from the database, so a stale session DTO cannot
 * authorise a privilege change. Client callers only ever receive the small DTOs
 * declared here, never raw Prisma records.
 */

export const ASSIGNABLE_ROLES: readonly Role[] = [
  "STUDENT",
  "REVIEWER",
  "ADMIN",
];

const PAGE_SIZE = 20;

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  activeSessions: number;
};

export type ListAdminUsersInput = {
  query?: string;
  role?: Role | null;
  page?: number;
};

export type ListAdminUsersResult = {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type RoleChangeResult =
  | { ok: true; previousRole: Role; changed: boolean }
  | {
      ok: false;
      reason:
        "forbidden" | "not_found" | "self" | "last_admin" | "invalid_role";
    };

export type RevokeSessionsResult =
  | { ok: true; count: number }
  | { ok: false; reason: "forbidden" | "not_found" | "self" };

export async function listAdminUsers({
  query = "",
  role = null,
  page = 1,
}: ListAdminUsersInput = {}): Promise<ListAdminUsersResult> {
  const search = query.trim().slice(0, 100);
  const currentPage = Number.isInteger(page) && page > 0 ? page : 1;
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(role ? { role } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, records] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
    }),
  ]);

  const ids = records.map((record) => record.id);
  const sessionCounts = ids.length
    ? await db.session.groupBy({
        by: ["userId"],
        where: {
          userId: { in: ids },
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        _count: { _all: true },
      })
    : [];
  const counts = new Map(
    sessionCounts.map((row) => [row.userId, row._count._all]),
  );

  return {
    users: records.map((record) => ({
      ...record,
      activeSessions: counts.get(record.id) ?? 0,
    })),
    total,
    page: currentPage,
    pageSize: PAGE_SIZE,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function changeUserRole({
  actorId,
  userId,
  role,
  ip,
}: {
  actorId: string;
  userId: string;
  role: Role;
  ip?: string;
}): Promise<RoleChangeResult> {
  if (!ASSIGNABLE_ROLES.includes(role))
    return { ok: false, reason: "invalid_role" };

  const [actor, target] = await Promise.all([
    db.user.findUnique({
      where: { id: actorId },
      select: { role: true, deletedAt: true },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { role: true, deletedAt: true },
    }),
  ]);

  if (!actor || actor.deletedAt || actor.role !== "ADMIN") {
    return { ok: false, reason: "forbidden" };
  }
  if (!target || target.deletedAt) return { ok: false, reason: "not_found" };
  if (actorId === userId) return { ok: false, reason: "self" };
  if (target.role === role) {
    return { ok: true, previousRole: target.role, changed: false };
  }

  if (target.role === "ADMIN" && role !== "ADMIN") {
    const adminCount = await db.user.count({
      where: { role: "ADMIN", deletedAt: null },
    });
    if (adminCount <= 1) return { ok: false, reason: "last_admin" };
  }

  await db.user.update({ where: { id: userId }, data: { role } });
  await recordAuditEvent({
    actorId,
    action: "admin.user_role_changed",
    entityType: "User",
    entityId: userId,
    metadata: { from: target.role, to: role, source: "admin_panel" },
    ip,
  });

  return { ok: true, previousRole: target.role, changed: true };
}

export async function revokeUserSessions({
  actorId,
  userId,
  ip,
}: {
  actorId: string;
  userId: string;
  ip?: string;
}): Promise<RevokeSessionsResult> {
  const [actor, target] = await Promise.all([
    db.user.findUnique({
      where: { id: actorId },
      select: { role: true, deletedAt: true },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { id: true, deletedAt: true },
    }),
  ]);

  if (!actor || actor.deletedAt || actor.role !== "ADMIN") {
    return { ok: false, reason: "forbidden" };
  }
  if (!target || target.deletedAt) return { ok: false, reason: "not_found" };
  if (actorId === userId) return { ok: false, reason: "self" };

  const result = await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await recordAuditEvent({
    actorId,
    action: "admin.user_sessions_revoked",
    entityType: "User",
    entityId: userId,
    metadata: { count: result.count, source: "admin_panel" },
    ip,
  });

  return { ok: true, count: result.count };
}
