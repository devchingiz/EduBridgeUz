import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  recordAuditEvent: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
  },
}));

vi.mock("@/lib/auth/audit", () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));

vi.mock("@/lib/observability/logger", () => ({
  logError: mocks.logError,
  logWarn: vi.fn(),
  logInfo: vi.fn(),
}));

import { promoteBootstrapAdmin } from "@/lib/auth/bootstrap-admin";
import { getBootstrapAdminEmails } from "@/lib/env";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.BOOTSTRAP_ADMIN_EMAILS = "";
  mocks.findUnique.mockResolvedValue({
    role: "STUDENT",
    emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
    deletedAt: null,
  });
  mocks.update.mockResolvedValue({ count: 1 });
  mocks.recordAuditEvent.mockResolvedValue(undefined);
  mocks.logError.mockImplementation(() => undefined);
});

afterAll(() => {
  delete process.env.BOOTSTRAP_ADMIN_EMAILS;
});

describe("bootstrap administrator emails", () => {
  it("normalises and deduplicates the configured list", () => {
    process.env.BOOTSTRAP_ADMIN_EMAILS =
      "Admin@Example.com, second@example.com\nadmin@example.com";

    expect(getBootstrapAdminEmails()).toEqual([
      "admin@example.com",
      "second@example.com",
    ]);
  });

  it("does nothing when the signing-in email is not configured", async () => {
    process.env.BOOTSTRAP_ADMIN_EMAILS = "owner@example.com";

    const promoted = await promoteBootstrapAdmin(
      "user-1",
      "student@example.com",
    );

    expect(promoted).toBe(false);
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("promotes a configured account and records an audit event", async () => {
    process.env.BOOTSTRAP_ADMIN_EMAILS = "owner@example.com, OTHER@example.com";

    const promoted = await promoteBootstrapAdmin(
      "user-1",
      "other@example.com",
      { ip: "198.51.100.1" },
    );

    expect(promoted).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { role: "SUPER_ADMIN" },
    });
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user-1",
        action: "auth.bootstrap_admin",
        entityType: "User",
        entityId: "user-1",
        metadata: {
          previousRole: "STUDENT",
          role: "SUPER_ADMIN",
          source: "BOOTSTRAP_ADMIN_EMAILS",
        },
        ip: "198.51.100.1",
      }),
    );
  });

  it("skips accounts that are already Super Admins or deleted", async () => {
    process.env.BOOTSTRAP_ADMIN_EMAILS = "owner@example.com";

    mocks.findUnique.mockResolvedValueOnce({
      role: "SUPER_ADMIN",
      emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
      deletedAt: null,
    });
    expect(await promoteBootstrapAdmin("user-1", "owner@example.com")).toBe(
      false,
    );

    mocks.findUnique.mockResolvedValueOnce({
      role: "STUDENT",
      emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
      deletedAt: new Date(),
    });
    expect(await promoteBootstrapAdmin("user-2", "owner@example.com")).toBe(
      false,
    );

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("does not promote an account with an unverified email", async () => {
    process.env.BOOTSTRAP_ADMIN_EMAILS = "owner@example.com";
    mocks.findUnique.mockResolvedValueOnce({
      role: "STUDENT",
      emailVerifiedAt: null,
      deletedAt: null,
    });

    expect(await promoteBootstrapAdmin("user-1", "owner@example.com")).toBe(
      false,
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("logs infrastructure failures without blocking sign-in", async () => {
    process.env.BOOTSTRAP_ADMIN_EMAILS = "owner@example.com";
    mocks.update.mockRejectedValueOnce(new Error("database unavailable"));

    const promoted = await promoteBootstrapAdmin("user-1", "owner@example.com");

    expect(promoted).toBe(false);
    expect(mocks.logError).toHaveBeenCalledWith(
      "auth.bootstrap_admin_failed",
      expect.any(Error),
    );
  });
});
