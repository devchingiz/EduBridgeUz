import "server-only";

import type { AdvisorConfig } from "@/lib/advisor/config";
import {
  combineSignals,
  isAbortError,
  numberValue,
  providerHttpError,
  readJson,
  safeJsonStringify,
} from "@/lib/advisor/providers/shared";
import {
  AdvisorProviderError,
  type AdvisorChatProvider,
  type AdvisorProviderRequest,
  type AdvisorProviderResponse,
  type AdvisorProviderTurn,
  type AdvisorToolCall,
} from "@/lib/advisor/providers/types";

type AnthropicBlock =
  | { type: "text"; text: string }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
  | { type: "tool_result"; tool_use_id: string; content: string };

type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | AnthropicBlock[];
};

function parseToolInput(argumentsText: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(argumentsText);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function mapTurns(turns: AdvisorProviderTurn[]): AnthropicMessage[] {
  const messages: AnthropicMessage[] = [];
  let pendingToolResults: AnthropicBlock[] = [];

  const flushToolResults = () => {
    if (pendingToolResults.length === 0) return;
    messages.push({ role: "user", content: pendingToolResults });
    pendingToolResults = [];
  };

  for (const turn of turns) {
    if (turn.role === "tool") {
      pendingToolResults.push({
        type: "tool_result",
        tool_use_id: turn.toolCallId,
        content: turn.content,
      });
      continue;
    }

    flushToolResults();

    if (turn.role === "user") {
      messages.push({ role: "user", content: turn.content });
      continue;
    }

    const blocks: AnthropicBlock[] = [];
    if (turn.content) {
      blocks.push({ type: "text", text: turn.content });
    }
    for (const call of turn.toolCalls) {
      blocks.push({
        type: "tool_use",
        id: call.id,
        name: call.name,
        input: parseToolInput(call.arguments),
      });
    }
    messages.push({
      role: "assistant",
      content: blocks.length > 0 ? blocks : [{ type: "text", text: " " }],
    });
  }

  flushToolResults();
  return messages;
}

function parseContent(value: unknown): {
  text: string;
  toolCalls: AdvisorToolCall[];
} {
  if (!Array.isArray(value)) return { text: "", toolCalls: [] };
  const text: string[] = [];
  const toolCalls: AdvisorToolCall[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const block = item as {
      type?: unknown;
      text?: unknown;
      id?: unknown;
      name?: unknown;
      input?: unknown;
    };
    if (block.type === "text" && typeof block.text === "string") {
      text.push(block.text);
      continue;
    }
    if (
      block.type === "tool_use" &&
      typeof block.name === "string" &&
      block.name
    ) {
      toolCalls.push({
        id:
          typeof block.id === "string" && block.id
            ? block.id.slice(0, 120)
            : `tool_${toolCalls.length + 1}`,
        name: block.name.slice(0, 80),
        arguments: safeJsonStringify(
          block.input && typeof block.input === "object" ? block.input : {},
        ),
      });
    }
  }

  return { text: text.join("\n").trim(), toolCalls };
}

export function createAnthropicProvider(
  config: AdvisorConfig,
): AdvisorChatProvider {
  return {
    id: "anthropic",
    model: config.model,
    async complete(
      request: AdvisorProviderRequest,
    ): Promise<AdvisorProviderResponse> {
      const signal = combineSignals(request.timeoutMs, request.signal);
      let response: Response;
      try {
        response = await fetch(`${config.baseUrl}/v1/messages`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": config.apiKey ?? "",
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: config.model,
            max_tokens: request.maxOutputTokens,
            temperature: 0.3,
            system: request.system,
            messages: mapTurns(request.turns),
            tools: request.tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              input_schema: tool.parameters,
            })),
          }),
          signal,
        });
      } catch (error) {
        if (isAbortError(error)) {
          throw new AdvisorProviderError(
            "provider_timeout",
            "Anthropic did not respond in time.",
          );
        }
        throw new AdvisorProviderError(
          "provider_unavailable",
          "Anthropic could not be reached.",
        );
      }

      if (!response.ok) {
        throw providerHttpError(response, "Anthropic");
      }

      const data = await readJson(response);
      const parsed = parseContent(data.content);
      if (!parsed.text && parsed.toolCalls.length === 0) {
        throw new AdvisorProviderError(
          "provider_invalid_response",
          "Anthropic returned no usable content.",
        );
      }

      const usage = (data.usage ?? {}) as {
        input_tokens?: unknown;
        output_tokens?: unknown;
      };
      const promptTokens = numberValue(usage.input_tokens);
      const completionTokens = numberValue(usage.output_tokens);

      return {
        text: parsed.text,
        toolCalls: parsed.toolCalls,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
        finishReason:
          typeof data.stop_reason === "string" ? data.stop_reason : null,
      };
    },
  };
}
