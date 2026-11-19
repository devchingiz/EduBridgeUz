import "server-only";

/**
 * Safe, client-mappable advisor failures. The message is always safe to show
 * and never contains provider bodies, prompts, keys, or user content.
 */
export type AdvisorErrorCode =
  | "invalid_request"
  | "not_found"
  | "rate_limited"
  | "usage_limit"
  | "blocked"
  | "ai_not_configured"
  | "provider_auth"
  | "provider_rate_limit"
  | "provider_unavailable"
  | "provider_timeout"
  | "provider_invalid_response";

export class AdvisorError extends Error {
  constructor(
    readonly code: AdvisorErrorCode,
    message: string,
    readonly retryAfterSeconds = 0,
    public conversationId?: string,
  ) {
    super(message);
    this.name = "AdvisorError";
  }
}

export function advisorErrorStatus(code: AdvisorErrorCode): number {
  switch (code) {
    case "invalid_request":
      return 400;
    case "not_found":
      return 404;
    case "blocked":
      return 403;
    case "rate_limited":
    case "usage_limit":
      return 429;
    case "ai_not_configured":
      return 503;
    default:
      return 503;
  }
}

export function advisorErrorUserMessage(code: AdvisorErrorCode): string {
  switch (code) {
    case "invalid_request":
      return "Check your message and try again.";
    case "not_found":
      return "That conversation could not be found.";
    case "rate_limited":
      return "You are sending messages too quickly. Try again shortly.";
    case "usage_limit":
      return "You have reached today's advisor limit. Try again tomorrow.";
    case "blocked":
      return "The advisor is temporarily unavailable. Try again later.";
    case "ai_not_configured":
      return "The advisor is not configured on this server yet.";
    case "provider_auth":
      return "The AI provider rejected the server credentials. Contact support.";
    case "provider_rate_limit":
      return "The AI provider is busy. Try again shortly.";
    case "provider_unavailable":
      return "The AI provider is temporarily unavailable. Try again later.";
    case "provider_timeout":
      return "The AI provider took too long to respond. Try again.";
    case "provider_invalid_response":
      return "The AI provider returned an unusable response. Try again.";
  }
}
