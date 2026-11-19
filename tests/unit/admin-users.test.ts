import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userCount: vi.fn(),
  userFindUnique: vi.fn(),
  userFindMany: vi.fn(),
  userUpdate: vi.fn(),
  sessionGroupBy: vi.fn(),
  sessionUpdateMany: vi.fn(),
  recordAuditEvent: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      count: mocks.userCount,
      findUnique: mocks.userFindUnique,
      findMany: mocks.userFindMany,
      update: mocks.userUpdate,
    },
    session: {
      groupBy: mocks.sessionGroupBy,
      updateMany: mocks.sessionUpdateMany,
    },
  },
}));

vi.mock("@/lib/auth/audit", () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));

import {
  changeUserRole,
  listAdminUsers,
  revokeUserSessions,
} from "@/lib/admin/users";

const adminActor = { role: "ADMIN", deletedAt: null };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userCount.mockResolvedValue(1);
  mocks.userFindUnique.mockResolvedValue(adminActor);
  mocks.userFindMany.mockResolvedValue([]);
  mocks.userUpdate.mockResolvedValue({ count: 1 });
  mocks.sessionGroupBy.mockResolvedValue([]);
  mocks.sessionUpdateMany.mockResolvedValue({ count: 2 });
  mocks.recordAuditEvent.mockResolvedValue(undefined);
});

describe("administrator user management", () => {
  it("lists a safe account DTO with active session counts", async () => {
    mocks.userCount.mockResolvedValue(21);
    mocks.userFindMany.mockResolvedValue([
      {
        id: "user-1",
        name: "Amina",
        email: "amina@example.com",
        role: "STUDENT",
        emailVerifiedAt: null,
        createdAt: new Date("2026-01-01"),
      },
    ]);
    mocks.sessionGroupBy.mockResolvedValue([
      { userId: "user-1", _count: { _all: 3 } },
    ]);

    const result = await listAdminUsers({ query: "amina", page: 1 });

    expect(result).toMatchObject({
      total: 21,
      page: 1,
      pageSize: 20,
      pageCount: 2,
      users: [{ id: "user-1", activeSessions: 3 }],
    });
    expect(mocks.userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: "amina", mode: "insensitive" } },
            { email: { contains: "amina", mode: "insensitive" } },
          ],
        }),
      }),
    );
  });

  it("rejects a reviewer actor even if the session DTO claims admin", async () => {
    mocks.userFindUnique
      .mockResolvedValueOnce({ role: "REVIEWER", deletedAt: null })
      .mockResolvedValueOnce({ role: "STUDENT", deletedAt: null });

    const result = await changeUserRole({
      actorId: "reviewer-1",
      userId: "student-1",
      role: "ADMIN",
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("refuses self-demotion", async () => {
    mocks.userFindUnique
      .mockResolvedValueOnce(adminActor)
      .mockResolvedValueOnce(adminActor);

    const result = await changeUserRole({
      actorId: "admin-1",
      userId: "admin-1",
      role: "STUDENT",
    });

    expect(result).toEqual({ ok: false, reason: "self" });
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("refuses to remove the last administrator", async () => {
    mocks.userFindUnique
      .mockResolvedValueOnce(adminActor)
      .mockResolvedValueOnce({ role: "ADMIN", deletedAt: null });
    mocks.userCount.mockResolvedValue(1);

    const result = await changeUserRole({
      actorId: "admin-1",
      userId: "admin-2",
      role: "REVIEWER",
    });

    expect(result).toEqual({ ok: false, reason: "last_admin" });
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("changes a role, audits it, and reports no-op changes", async () => {
    mocks.userFindUnique
      .mockResolvedValueOnce(adminActor)
      .mockResolvedValueOnce({ role: "STUDENT", deletedAt: null });

    const result = await changeUserRole({
      actorId: "admin-1",
      userId: "student-1",
      role: "REVIEWER",
      ip: "198.51.100.1",
    });

    expect(result).toEqual({
      ok: true,
      previousRole: "STUDENT",
      changed: true,
    });
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "student-1" },
      data: { role: "REVIEWER" },
    });
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin.user_role_changed",
        metadata: {
          from: "STUDENT",
          to: "REVIEWER",
          source: "admin_panel",
        },
        ip: "198.51.100.1",
      }),
    );

    mocks.userFindUnique
      .mockResolvedValueOnce(adminActor)
      .mockResolvedValueOnce({ role: "REVIEWER", deletedAt: null });
    const noOp = await changeUserRole({
      actorId: "admin-1",
      userId: "student-1",
      role: "REVIEWER",
    });
    expect(noOp).toEqual({
      ok: true,
      previousRole: "REVIEWER",
      changed: false,
    });
  });

  it("revokes another account's sessions and audits the count", async () => {
    mocks.userFindUnique
      .mockResolvedValueOnce(adminActor)
      .mockResolvedValueOnce({ id: "student-1", deletedAt: null });

    const result = await revokeUserSessions({
      actorId: "admin-1",
      userId: "student-1",
    });

    expect(result).toEqual({ ok: true, count: 2 });
    expect(mocks.sessionUpdateMany).toHaveBeenCalledWith({
      where: { userId: "student-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin.user_sessions_revoked",
        metadata: { count: 2, source: "admin_panel" },
      }),
    );
  });
});
