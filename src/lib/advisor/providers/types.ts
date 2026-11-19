export type AdvisorProviderId =
  "openai" | "anthropic" | "openrouter" | "compatible";

export type AdvisorToolCall = {
  id: string;
  name: string;
  /** Raw JSON string supplied by the provider; validated before execution. */
  arguments: string;
};

export type AdvisorProviderTurn =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls: AdvisorToolCall[] }
  | { role: "tool"; toolCallId: string; name: string; content: string };

export type AdvisorToolSpec = {
  name: string;
  description: string;
  /** JSON Schema object generated from the tool's Zod input schema. */
  parameters: Record<string, unknown>;
};

export type AdvisorProviderUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type AdvisorProviderRequest = {
  system: string;
  turns: AdvisorProviderTurn[];
  tools: AdvisorToolSpec[];
  maxOutputTokens: number;
  timeoutMs: number;
  signal?: AbortSignal;
};

export type AdvisorProviderResponse = {
  text: string;
  toolCalls: AdvisorToolCall[];
  usage: AdvisorProviderUsage;
  finishReason: string | null;
};

export type AdvisorProviderErrorCode =
  | "provider_auth"
  | "provider_rate_limit"
  | "provider_unavailable"
  | "provider_timeout"
  | "provider_invalid_response"
  | "provider_request";

export class AdvisorProviderError extends Error {
  constructor(
    readonly code: AdvisorProviderErrorCode,
    message: string,
    readonly statusCode?: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "AdvisorProviderError";
  }
}

export type AdvisorChatProvider = {
  id: string;
  model: string;
  complete(request: AdvisorProviderRequest): Promise<AdvisorProviderResponse>;
};
