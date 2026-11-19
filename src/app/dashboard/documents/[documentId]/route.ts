import { requireWorkspace } from "@/lib/auth/dal";
import { PRIVATE_DOCUMENT_TYPES } from "@/lib/workspace/constants";
import { getOwnedDocument } from "@/lib/workspace/service";
import { readPrivateDocument } from "@/lib/workspace/storage";
import { logError } from "@/lib/observability/logger";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ documentId: string }> },
): Promise<Response> {
  const session = await requireWorkspace();
  const { documentId } = await context.params;
  const document = await getOwnedDocument(session.user.id, documentId);
  if (!document || !Object.hasOwn(PRIVATE_DOCUMENT_TYPES, document.mimeType)) {
    return new Response("Not found.", {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  let bytes: Buffer | null;
  try {
    bytes = await readPrivateDocument(document.storageKey);
  } catch (error) {
    logError("storage.document_download_failed", error, {
      route: "/dashboard/documents/[documentId]",
      method: "GET",
      statusCode: 503,
    });
    return new Response("Document is unavailable.", {
      status: 503,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  if (!bytes || bytes.length !== document.sizeBytes) {
    return new Response("Document is unavailable.", {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Length": String(document.sizeBytes),
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(document.name)}`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Referrer-Policy": "no-referrer",
    },
  });
}
