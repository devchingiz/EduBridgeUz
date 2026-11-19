import { StudentDocumentCategory } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { assertSameOrigin, getRequestContext } from "@/lib/http/request";
import { requireWorkspace } from "@/lib/auth/dal";
import { AUTH_RATE_LIMITS } from "@/lib/auth/rate-limits";
import { enforceRateLimits } from "@/lib/security/rate-limit";
import {
  DOCUMENT_CATEGORIES,
  PRIVATE_DOCUMENT_MAX_BYTES,
} from "@/lib/workspace/constants";
import {
  inspectDocumentUpload,
  removePrivateDocument,
  storePrivateDocument,
} from "@/lib/workspace/storage";
import { db } from "@/lib/db";
import { scanForMalware } from "@/lib/workspace/malware-scanner";
import { recordAuditEvent } from "@/lib/auth/audit";
import { logError } from "@/lib/observability/logger";

export const runtime = "nodejs";

const MAX_MULTIPART_BYTES = PRIVATE_DOCUMENT_MAX_BYTES + 64 * 1024;

function redirectTo(result: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: `/dashboard/documents?${result}` },
  });
}

export async function POST(request: Request): Promise<Response> {
  if (!request.headers.get("origin")) {
    return new Response("Origin required.", { status: 403 });
  }
  await assertSameOrigin();
  const session = await requireWorkspace();
  const requestContext = await getRequestContext();
  const limited = await enforceRateLimits([
    {
      ...AUTH_RATE_LIMITS.workspaceUploadUser,
      identifier: session.user.id,
    },
    {
      ...AUTH_RATE_LIMITS.workspaceUploadIp,
      identifier: requestContext.ip,
    },
  ]);
  if (limited) {
    return new Response(null, {
      status: 303,
      headers: {
        Location: "/dashboard/documents?error=rate-limited",
        "Retry-After": String(limited.retryAfterSeconds),
      },
    });
  }
  const contentLengthHeader = request.headers.get("content-length");
  const contentLength = Number(contentLengthHeader);
  if (
    !contentLengthHeader ||
    !Number.isSafeInteger(contentLength) ||
    contentLength < 1 ||
    contentLength > MAX_MULTIPART_BYTES
  ) {
    return redirectTo("error=too-large");
  }
  if (
    !request.headers.get("content-type")?.startsWith("multipart/form-data;")
  ) {
    return redirectTo("error=invalid-upload");
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const categoryValue = formData.get("category");
  const suppliedName = formData.get("name");
  if (
    !(file instanceof File) ||
    typeof categoryValue !== "string" ||
    !(DOCUMENT_CATEGORIES as readonly string[]).includes(categoryValue)
  ) {
    return redirectTo("error=invalid-upload");
  }

  const accepted = await inspectDocumentUpload(file);
  if (!accepted) return redirectTo("error=invalid-upload");

  const rawName =
    typeof suppliedName === "string" && suppliedName.trim()
      ? suppliedName
      : file.name;
  const name = rawName
    .replace(/[\\/\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 120);
  if (!name) return redirectTo("error=invalid-upload");

  await recordAuditEvent({
    actorId: session.user.id,
    action: "document.scan_started",
    entityType: "Student",
    entityId: session.user.id,
    metadata: {
      status: "PENDING",
      mimeType: accepted.mimeType,
      sizeBytes: accepted.bytes.length,
    },
  });

  const processing: {
    scanStatus: "PENDING" | "CLEAN" | "INFECTED" | "FAILED";
  } = { scanStatus: "PENDING" };
  let verdict: "clean" | "infected";
  try {
    verdict = await storePrivateDocument(
      accepted.storageKey,
      accepted.bytes,
      accepted.mimeType,
      async (bytes) => {
        try {
          const result = await scanForMalware(bytes);
          processing.scanStatus = result === "clean" ? "CLEAN" : "INFECTED";
          return result;
        } catch (error) {
          processing.scanStatus = "FAILED";
          throw error;
        }
      },
    );
  } catch (error) {
    logError("storage.upload_processing_failed", error, {
      status: processing.scanStatus,
      route: "/dashboard/documents/upload",
      method: "POST",
    });
    await recordAuditEvent({
      actorId: session.user.id,
      action:
        processing.scanStatus === "FAILED"
          ? "document.scan_failed"
          : "document.upload_failed",
      entityType: "Student",
      entityId: session.user.id,
      metadata: {
        status:
          processing.scanStatus === "FAILED" ? "FAILED" : "PROCESSING_FAILED",
        mimeType: accepted.mimeType,
        sizeBytes: accepted.bytes.length,
      },
    });
    return redirectTo(
      processing.scanStatus === "FAILED"
        ? "error=scanner-unavailable"
        : "error=upload-failed",
    );
  }

  if (verdict === "infected") {
    await recordAuditEvent({
      actorId: session.user.id,
      action: "document.upload_quarantined",
      entityType: "Student",
      entityId: session.user.id,
      metadata: {
        status: "INFECTED",
        mimeType: accepted.mimeType,
        sizeBytes: accepted.bytes.length,
      },
    });
    return redirectTo("error=quarantined");
  }

  try {
    await db.studentDocument.create({
      data: {
        userId: session.user.id,
        name,
        category: categoryValue as StudentDocumentCategory,
        storageKey: accepted.storageKey,
        mimeType: accepted.mimeType,
        sizeBytes: accepted.bytes.length,
      },
    });
  } catch (error) {
    await removePrivateDocument(accepted.storageKey);
    await recordAuditEvent({
      actorId: session.user.id,
      action: "document.upload_failed",
      entityType: "Student",
      entityId: session.user.id,
      metadata: {
        status: "METADATA_FAILED",
        mimeType: accepted.mimeType,
        sizeBytes: accepted.bytes.length,
      },
    });
    throw error;
  }

  await recordAuditEvent({
    actorId: session.user.id,
    action: "document.upload_clean",
    entityType: "Student",
    entityId: session.user.id,
    metadata: {
      status: "CLEAN",
      mimeType: accepted.mimeType,
      sizeBytes: accepted.bytes.length,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/documents");
  revalidatePath("/dashboard/notifications");
  return redirectTo("uploaded=1");
}
