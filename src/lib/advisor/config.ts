import "server-only";

import { isProduction } from "@/lib/env";

export const ADVISOR_PROVIDERS = [
  "openai",
  "anthropic",
  "openrouter",
  "compatible",
] as const;

export type AdvisorProviderId = (typeof ADVISOR_PROVIDERS)[number];

export type AdvisorPricing = {
  /** USD per one million input tokens. */
  inputPerMillion: number;
  /** USD per one million output tokens. */
  outputPerMillion: number;
};

export type AdvisorConfig = {
  enabled: boolean;
  provider: AdvisorProviderId;
  model: string;
  apiKey: string | null;
  baseUrl: string;
  timeoutMs: number;
  maxOutputTokens: number;
  maxContextMessages: number;
  maxInputChars: number;
  maxToolRounds: number;
  maxToolsPerRound: number;
  messagesPerMinute: number;
  dailyUserMessages: number;
  dailyUserCostMicros: number;
  dailyGlobalCostMicros: number;
  pricing: AdvisorPricing;
};

export type AdvisorStatus =
  | {
      enabled: true;
      provider: AdvisorProviderId;
      model: string;
      reason: null;
    }
  | {
      enabled: false;
      provider: AdvisorProviderId | null;
      model: string | null;
      reason: "missing_key" | "misconfigured";
    };

function read(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

function integer(
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = read(name);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

function amount(name: string, fallback: number): number {
  const raw = read(name);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number.`);
  }
  return value;
}

function isLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

function checkedBaseUrl(value: string, provider: AdvisorProviderId): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("AI_BASE_URL must be a valid URL.");
  }
  if (url.username || url.password) {
    throw new Error("AI_BASE_URL must not contain credentials.");
  }
  if (url.protocol !== "https:" && !isLocalHost(url.hostname)) {
    throw new Error("AI_BASE_URL must use HTTPS outside local development.");
  }
  if (url.protocol === "http:" && isProduction()) {
    throw new Error("AI_BASE_URL must use HTTPS in production.");
  }
  if (provider === "compatible" && !value) {
    throw new Error("AI_BASE_URL is required when AI_PROVIDER=compatible.");
  }
  return url.toString().replace(/\/+$/, "");
}

function providerDefaultBaseUrl(provider: AdvisorProviderId): string {
  switch (provider) {
    case "anthropic":
      return "https://api.anthropic.com";
    case "openrouter":
      return "https://openrouter.ai/api/v1";
    case "openai":
    case "compatible":
      return "https://api.openai.com/v1";
  }
}

const DEFAULT_PRICING: Record<string, AdvisorPricing> = {
  "gpt-4.1-mini": { inputPerMillion: 0.4, outputPerMillion: 1.6 },
  "gpt-4.1": { inputPerMillion: 2, outputPerMillion: 8 },
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  "gpt-4o": { inputPerMillion: 2.5, outputPerMillion: 10 },
  "claude-3-5-haiku-latest": { inputPerMillion: 0.8, outputPerMillion: 4 },
  "claude-3-5-sonnet-latest": { inputPerMillion: 3, outputPerMillion: 15 },
  "claude-sonnet-4-20250514": { inputPerMillion: 3, outputPerMillion: 15 },
};

/**
 * Conservative fallback for a model that is not in the pricing table. Cost
 * monitoring must never fail open because a model name is unfamiliar.
 */
const FALLBACK_PRICING: AdvisorPricing = {
  inputPerMillion: 2,
  outputPerMillion: 8,
};

function pricingFor(model: string): AdvisorPricing {
  const configuredInput = read("AI_PRICE_INPUT_PER_MILLION");
  const configuredOutput = read("AI_PRICE_OUTPUT_PER_MILLION");
  if (configuredInput || configuredOutput) {
    return {
      inputPerMillion: amount(
        "AI_PRICE_INPUT_PER_MILLION",
        FALLBACK_PRICING.inputPerMillion,
      ),
      outputPerMillion: amount(
        "AI_PRICE_OUTPUT_PER_MILLION",
        FALLBACK_PRICING.outputPerMillion,
      ),
    };
  }
  return DEFAULT_PRICING[model] ?? FALLBACK_PRICING;
}

export function getAdvisorConfig(): AdvisorConfig {
  const providerValue = read("AI_PROVIDER") ?? "openai";
  if (!(ADVISOR_PROVIDERS as readonly string[]).includes(providerValue)) {
    throw new Error(
      `AI_PROVIDER must be one of: ${ADVISOR_PROVIDERS.join(", ")}.`,
    );
  }
  const provider = providerValue as AdvisorProviderId;

  const model = read("AI_MODEL") ?? "gpt-4.1-mini";
  if (!/^[A-Za-z0-9._:/-]{1,120}$/.test(model)) {
    throw new Error("AI_MODEL contains unsupported characters.");
  }

  const configuredBaseUrl = read("AI_BASE_URL");
  if (provider === "compatible" && !configuredBaseUrl) {
    throw new Error("AI_BASE_URL is required when AI_PROVIDER=compatible.");
  }
  const baseUrl = configuredBaseUrl
    ? checkedBaseUrl(configuredBaseUrl, provider)
    : providerDefaultBaseUrl(provider);

  const apiKey = read("AI_API_KEY") ?? null;

  return {
    enabled: Boolean(apiKey),
    provider,
    model,
    apiKey,
    baseUrl,
    timeoutMs: integer("AI_TIMEOUT_MS", 30_000, 1_000, 120_000),
    maxOutputTokens: integer("AI_MAX_OUTPUT_TOKENS", 1_200, 128, 4_096),
    maxContextMessages: integer("AI_MAX_CONTEXT_MESSAGES", 16, 2, 40),
    maxInputChars: integer("AI_MAX_INPUT_CHARS", 4_000, 200, 12_000),
    maxToolRounds: integer("AI_MAX_TOOL_ROUNDS", 4, 1, 8),
    maxToolsPerRound: integer("AI_MAX_TOOLS_PER_ROUND", 5, 1, 10),
    messagesPerMinute: integer("AI_MESSAGES_PER_MINUTE", 8, 1, 60),
    dailyUserMessages: integer("AI_DAILY_USER_MESSAGES", 40, 1, 500),
    dailyUserCostMicros: Math.round(
      amount("AI_DAILY_USER_COST_USD", 2) * 1_000_000,
    ),
    dailyGlobalCostMicros: Math.round(
      amount("AI_DAILY_GLOBAL_COST_USD", 25) * 1_000_000,
    ),
    pricing: pricingFor(model),
  };
}

/**
 * UI-safe status. Never returns the key or base URL; a misconfigured provider
 * is reported as a setup problem rather than crashing every dashboard page.
 */
export function getAdvisorStatus(): AdvisorStatus {
  try {
    const config = getAdvisorConfig();
    if (!config.enabled) {
      return {
        enabled: false,
        provider: config.provider,
        model: config.model,
        reason: "missing_key",
      };
    }
    return {
      enabled: true,
      provider: config.provider,
      model: config.model,
      reason: null,
    };
  } catch {
    return {
      enabled: false,
      provider: null,
      model: null,
      reason: "misconfigured",
    };
  }
}

/** Converts token counts to micro-USD (one millionth of a US dollar). */
export function estimateCostMicros(
  pricing: AdvisorPricing,
  promptTokens: number,
  completionTokens: number,
): number {
  const prompt = Math.max(0, Math.round(promptTokens));
  const completion = Math.max(0, Math.round(completionTokens));
  return Math.max(
    0,
    Math.round(
      prompt * pricing.inputPerMillion + completion * pricing.outputPerMillion,
    ),
  );
}
