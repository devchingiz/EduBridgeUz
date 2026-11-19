import "server-only";

import type { AdvisorConfig } from "@/lib/advisor/config";
import {
  combineSignals,
  isAbortError,
  numberValue,
  providerHttpError,
  readJson,
  safeJsonStringify,
  textValue,
} from "@/lib/advisor/providers/shared";
import {
  AdvisorProviderError,
  type AdvisorChatProvider,
  type AdvisorProviderRequest,
  type AdvisorProviderResponse,
  type AdvisorToolCall,
} from "@/lib/advisor/providers/types";

type OpenAiMessage =
  | { role: "system" | "user"; content: string }
  | { role: "tool"; tool_call_id: string; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    };

function mapTurns(request: AdvisorProviderRequest): OpenAiMessage[] {
  const messages: OpenAiMessage[] = [
    { role: "system", content: request.system },
  ];

  for (const turn of request.turns) {
    if (turn.role === "user") {
      messages.push({ role: "user", content: turn.content });
      continue;
    }
    if (turn.role === "tool") {
      messages.push({
        role: "tool",
        tool_call_id: turn.toolCallId,
        content: turn.content,
      });
      continue;
    }

    messages.push({
      role: "assistant",
      content: turn.content || null,
      ...(turn.toolCalls.length > 0
        ? {
            tool_calls: turn.toolCalls.map((call) => ({
              id: call.id,
              type: "function" as const,
              function: {
                name: call.name,
                arguments: call.arguments,
              },
            })),
          }
        : {}),
    });
  }

  return messages;
}

function parseToolCalls(value: unknown): AdvisorToolCall[] {
  if (!Array.isArray(value)) return [];
  const calls: AdvisorToolCall[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as {
      id?: unknown;
      function?: { name?: unknown; arguments?: unknown };
    };
    const name =
      typeof record.function?.name === "string"
        ? record.function.name.slice(0, 80)
        : "";
    if (!name) continue;
    const args = record.function?.arguments;
    calls.push({
      id:
        typeof record.id === "string" && record.id
          ? record.id.slice(0, 120)
          : `call_${calls.length + 1}`,
      name,
      arguments:
        typeof args === "string"
          ? args
          : safeJsonStringify(args && typeof args === "object" ? args : {}),
    });
  }
  return calls;
}

export function createOpenAiCompatibleProvider(
  config: AdvisorConfig,
  providerName: "OpenAI" | "OpenRouter" | "compatible endpoint",
): AdvisorChatProvider {
  return {
    id: config.provider,
    model: config.model,
    async complete(
      request: AdvisorProviderRequest,
    ): Promise<AdvisorProviderResponse> {
      const signal = combineSignals(request.timeoutMs, request.signal);
      let response: Response;
      try {
        response = await fetch(`${config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${config.apiKey ?? ""}`,
            ...(config.provider === "openrouter"
              ? { "x-title": "EduBridge Advisor" }
              : {}),
          },
          body: JSON.stringify({
            model: config.model,
            messages: mapTurns(request),
            tools: request.tools.map((tool) => ({
              type: "function",
              function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
              },
            })),
            tool_choice: request.tools.length > 0 ? "auto" : "none",
            max_tokens: request.maxOutputTokens,
            temperature: 0.3,
          }),
          signal,
        });
      } catch (error) {
        if (isAbortError(error)) {
          throw new AdvisorProviderError(
            "provider_timeout",
            `${providerName} did not respond in time.`,
          );
        }
        throw new AdvisorProviderError(
          "provider_unavailable",
          `${providerName} could not be reached.`,
        );
      }

      if (!response.ok) {
        throw providerHttpError(response, providerName);
      }

      const data = await readJson(response);
      const choices = Array.isArray(data.choices) ? data.choices : [];
      const first = choices[0] as
        | {
            message?: {
              content?: unknown;
              tool_calls?: unknown;
            };
            finish_reason?: unknown;
          }
        | undefined;

      if (!first?.message) {
        throw new AdvisorProviderError(
          "provider_invalid_response",
          `${providerName} returned no message.`,
        );
      }

      const usage = (data.usage ?? {}) as {
        prompt_tokens?: unknown;
        completion_tokens?: unknown;
        total_tokens?: unknown;
      };
      const promptTokens = numberValue(usage.prompt_tokens);
      const completionTokens = numberValue(usage.completion_tokens);

      return {
        text: textValue(first.message.content).trim(),
        toolCalls: parseToolCalls(first.message.tool_calls),
        usage: {
          promptTokens,
          completionTokens,
          totalTokens:
            numberValue(usage.total_tokens) || promptTokens + completionTokens,
        },
        finishReason:
          typeof first.finish_reason === "string" ? first.finish_reason : null,
      };
    },
  };
}
