import "server-only";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { logError } from "@/lib/observability/logger";
import { hashIdentifier } from "@/lib/security/crypto";

export type AuditInput = {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string;
};

/**
 * Append-only audit trail. Metadata must never contain passwords, tokens, or
 * document contents. Failures are logged but never block the user's action;
 * the operation itself is the source of truth.
 */
export async function recordAuditEvent({
  actorId,
  action,
  entityType,
  entityId,
  metadata,
  ip,
}: AuditInput): Promise<void> {
  try {
    await db.auditEvent.create({
      data: {
        actorId: actorId ?? null,
        action,
        entityType,
        entityId,
        metadata,
        ipHash: ip && ip !== "unknown" ? hashIdentifier(ip) : null,
      },
    });
  } catch (error) {
    logError("audit.write_failed", error, { action, entityType });
  }
}
