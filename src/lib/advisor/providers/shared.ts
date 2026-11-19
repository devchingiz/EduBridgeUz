import "server-only";

import { AdvisorProviderError } from "@/lib/advisor/providers/types";

export function combineSignals(
  timeoutMs: number,
  signal?: AbortSignal,
): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

export function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

export function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.max(1, Math.ceil(seconds));
  }
  const date = Date.parse(value);
  if (!Number.isNaN(date)) {
    return Math.max(1, Math.ceil((date - Date.now()) / 1000));
  }
  return undefined;
}

export async function readJson(
  response: Response,
): Promise<Record<string, unknown>> {
  try {
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new AdvisorProviderError(
        "provider_invalid_response",
        "The AI provider returned a non-object response.",
      );
    }
    return data as Record<string, unknown>;
  } catch (error) {
    if (error instanceof AdvisorProviderError) throw error;
    throw new AdvisorProviderError(
      "provider_invalid_response",
      "The AI provider returned invalid JSON.",
    );
  }
}

export function providerHttpError(
  response: Response,
  providerName: string,
): AdvisorProviderError {
  const retryAfterSeconds = parseRetryAfter(
    response.headers.get("retry-after"),
  );
  if (response.status === 401 || response.status === 403) {
    return new AdvisorProviderError(
      "provider_auth",
      `${providerName} rejected the configured credentials.`,
      response.status,
    );
  }
  if (response.status === 429) {
    return new AdvisorProviderError(
      "provider_rate_limit",
      `${providerName} rate-limited the request.`,
      response.status,
      retryAfterSeconds,
    );
  }
  if (response.status >= 500) {
    return new AdvisorProviderError(
      "provider_unavailable",
      `${providerName} is unavailable.`,
      response.status,
      retryAfterSeconds,
    );
  }
  return new AdvisorProviderError(
    "provider_request",
    `${providerName} rejected the request.`,
    response.status,
  );
}

export function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : 0;
}

export function textValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          const record = part as { text?: unknown };
          return typeof record.text === "string" ? record.text : "";
        }
        return "";
      })
      .join("");
  }
  return "";
}

export function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "{}";
  }
}
