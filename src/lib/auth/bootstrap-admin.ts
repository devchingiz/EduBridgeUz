import "server-only";

import { db } from "@/lib/db";
import { recordAuditEvent } from "@/lib/auth/audit";
import { getBootstrapAdminEmails } from "@/lib/env";
import { logError } from "@/lib/observability/logger";

type BootstrapContext = { ip?: string };

/**
 * Operator-controlled bootstrap for the very first Super Admin.
 *
 * An email is promoted only when a trusted deployment sets
 * `BOOTSTRAP_ADMIN_EMAILS` and that exact verified account signs in
 * successfully. There
 * is deliberately no client-supplied role, token, or self-service route. The
 * audit event makes the grant attributable, and a temporary infrastructure
 * failure never blocks an otherwise valid sign-in.
 */
export async function promoteBootstrapAdmin(
  userId: string,
  email: string,
  context: BootstrapContext = {},
): Promise<boolean> {
  if (!getBootstrapAdminEmails().includes(email.trim().toLowerCase())) {
    return false;
  }

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { role: true, emailVerifiedAt: true, deletedAt: true },
    });
    if (
      !user ||
      user.deletedAt ||
      !user.emailVerifiedAt ||
      user.role === "SUPER_ADMIN"
    ) {
      return false;
    }

    await db.user.update({
      where: { id: userId },
      data: { role: "SUPER_ADMIN" },
    });

    await recordAuditEvent({
      actorId: userId,
      action: "auth.bootstrap_admin",
      entityType: "User",
      entityId: userId,
      metadata: {
        previousRole: user.role,
        role: "SUPER_ADMIN",
        source: "BOOTSTRAP_ADMIN_EMAILS",
      },
      ip: context.ip,
    });

    return true;
  } catch (error) {
    logError("auth.bootstrap_admin_failed", error);
    return false;
  }
}
