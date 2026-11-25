import { getWorkspaceStatus } from "@/lib/auth/dal";
import { getSession } from "@/lib/auth/session";
import { getVerificationRequirement } from "@/lib/auth/verification-policy";
import { handleAdvisorChat } from "@/lib/advisor/chat";
import {
  advisorErrorStatus,
  AdvisorError,
  type AdvisorErrorCode,
} from "@/lib/advisor/errors";
import type { AdvisorErrorResponse } from "@/lib/advisor/types";
import { parseAdvisorChatRequest } from "@/lib/advisor/validation";
import { assertSameOrigin } from "@/lib/http/request";
import { logError } from "@/lib/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BODY_CHARS = 32_000;
/** Hard upper bound from `AI_MAX_INPUT_CHARS`; the final check uses config. */
const VALIDATION_MAX_INPUT_CHARS = 12_000;

function noStoreHeaders(retryAfterSeconds?: number): HeadersInit {
  return {
    "Cache-Control": "no-store",
    ...(retryAfterSeconds && retryAfterSeconds > 0
      ? { "Retry-After": String(retryAfterSeconds) }
      : {}),
  };
}

function jsonError(
  code: AdvisorErrorCode | "unauthorized",
  message: string,
  status: number,
  retryAfterSeconds?: number,
  conversationId?: string,
): Response {
  const body: AdvisorErrorResponse = {
    error: {
      code,
      message,
      ...(retryAfterSeconds && retryAfterSeconds > 0
        ? { retryAfterSeconds }
        : {}),
      ...(conversationId ? { conversationId } : {}),
    },
  };
  return Response.json(body, {
    status,
    headers: noStoreHeaders(retryAfterSeconds),
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    await assertSameOrigin();
  } catch {
    return jsonError("unauthorized", "Cross-origin request rejected.", 403);
  }

  const session = await getSession();
  if (!session) {
    return jsonError("unauthorized", "Sign in to use the advisor.", 401);
  }

  if (getVerificationRequirement(session.user).state === "required") {
    return jsonError("blocked", "Verify your email to use the advisor.", 403);
  }

  const status = await getWorkspaceStatus(session.user);
  if (!status.canUseWorkspace) {
    return jsonError(
      "blocked",
      "The advisor is unavailable until guardian consent is granted.",
      403,
    );
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_CHARS) {
    return jsonError(
      "invalid_request",
      "Check your message and try again.",
      400,
    );
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return jsonError(
      "invalid_request",
      "Check your message and try again.",
      400,
    );
  }
  if (raw.length > MAX_BODY_CHARS) {
    return jsonError(
      "invalid_request",
      "Check your message and try again.",
      400,
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    return jsonError(
      "invalid_request",
      "Check your message and try again.",
      400,
    );
  }

  try {
    const input = parseAdvisorChatRequest(body, VALIDATION_MAX_INPUT_CHARS);
    const result = await handleAdvisorChat(session.user.id, input);
    return Response.json(result, { headers: noStoreHeaders() });
  } catch (error) {
    if (error instanceof AdvisorError) {
      return jsonError(
        error.code,
        error.message,
        advisorErrorStatus(error.code),
        error.retryAfterSeconds,
        error.conversationId,
      );
    }

    logError("advisor.route_failed", error, { route: "/api/advisor/chat" });
    return jsonError(
      "provider_unavailable",
      "The AI provider is temporarily unavailable. Try again later.",
      503,
    );
  }
}
