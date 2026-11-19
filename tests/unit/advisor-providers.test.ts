import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdvisorConfig } from "@/lib/advisor/config";
import { createAdvisorProvider } from "@/lib/advisor/providers";
import {
  parseRetryAfter,
  providerHttpError,
  textValue,
} from "@/lib/advisor/providers/shared";
import {
  AdvisorProviderError,
  type AdvisorProviderRequest,
} from "@/lib/advisor/providers/types";

function config(overrides: Partial<AdvisorConfig> = {}): AdvisorConfig {
  return {
    enabled: true,
    provider: "openai",
    model: "gpt-4.1-mini",
    apiKey: "sk-test-key",
    baseUrl: "https://api.openai.com/v1",
    timeoutMs: 30_000,
    maxOutputTokens: 1_200,
    maxContextMessages: 16,
    maxInputChars: 4_000,
    maxToolRounds: 4,
    maxToolsPerRound: 5,
    messagesPerMinute: 8,
    dailyUserMessages: 40,
    dailyUserCostMicros: 2_000_000,
    dailyGlobalCostMicros: 25_000_000,
    pricing: { inputPerMillion: 0.4, outputPerMillion: 1.6 },
    ...overrides,
  };
}

function request(
  overrides: Partial<AdvisorProviderRequest> = {},
): AdvisorProviderRequest {
  return {
    system: "system prompt",
    turns: [{ role: "user", content: "hello" }],
    tools: [],
    maxOutputTokens: 1_200,
    timeoutMs: 30_000,
    ...overrides,
  };
}

describe("advisor provider adapters", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("selects the configured adapter", () => {
    expect(createAdvisorProvider(config()).id).toBe("openai");
    expect(createAdvisorProvider(config({ provider: "openrouter" })).id).toBe(
      "openrouter",
    );
    expect(createAdvisorProvider(config({ provider: "compatible" })).id).toBe(
      "compatible",
    );
    expect(createAdvisorProvider(config({ provider: "anthropic" })).id).toBe(
      "anthropic",
    );
  });

  it("parses an OpenAI-compatible response and sends safe request fields", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        choices: [
          {
            message: {
              content: "Use [the source](https://example.edu/admissions).",
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: {
                    name: "get_student_overview",
                    arguments: '{"includeDocuments":false}',
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
        usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 },
      }),
    );

    const result = await createAdvisorProvider(config()).complete(
      request({
        tools: [
          {
            name: "get_student_overview",
            description: "Read student overview",
            parameters: { type: "object", properties: {} },
          },
        ],
      }),
    );

    expect(result).toEqual({
      text: "Use [the source](https://example.edu/admissions).",
      toolCalls: [
        {
          id: "call_1",
          name: "get_student_overview",
          arguments: '{"includeDocuments":false}',
        },
      ],
      usage: { promptTokens: 12, completionTokens: 7, totalTokens: 19 },
      finishReason: "tool_calls",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(headers.authorization).toBe("Bearer sk-test-key");
    expect(body).toMatchObject({
      model: "gpt-4.1-mini",
      tool_choice: "auto",
      max_tokens: 1_200,
      temperature: 0.3,
    });
  });

  it("maps OpenAI-compatible HTTP failures to safe error codes", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    await expect(
      createAdvisorProvider(config()).complete(request()),
    ).rejects.toMatchObject({ code: "provider_auth" });

    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 429, headers: { "retry-after": "12" } }),
    );
    await expect(
      createAdvisorProvider(config()).complete(request()),
    ).rejects.toMatchObject({
      code: "provider_rate_limit",
      retryAfterSeconds: 12,
    });

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
    await expect(
      createAdvisorProvider(config()).complete(request()),
    ).rejects.toMatchObject({ code: "provider_unavailable" });

    fetchMock.mockResolvedValueOnce(new Response("not json", { status: 200 }));
    await expect(
      createAdvisorProvider(config()).complete(request()),
    ).rejects.toMatchObject({ code: "provider_invalid_response" });
  });

  it("maps provider timeouts to a timeout error", async () => {
    fetchMock.mockRejectedValueOnce(
      Object.assign(new Error("timed out"), { name: "TimeoutError" }),
    );

    await expect(
      createAdvisorProvider(config()).complete(request()),
    ).rejects.toMatchObject({ code: "provider_timeout" });
  });

  it("parses Anthropic text and tool blocks with scoped message mapping", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        content: [
          { type: "text", text: "First line" },
          {
            type: "tool_use",
            id: "toolu_1",
            name: "list_applications",
            input: { limit: 5 },
          },
          { type: "text", text: "Second line" },
        ],
        usage: { input_tokens: 21, output_tokens: 9 },
        stop_reason: "tool_use",
      }),
    );

    const result = await createAdvisorProvider(
      config({
        provider: "anthropic",
        model: "claude-3-5-haiku-latest",
        baseUrl: "https://api.anthropic.com",
      }),
    ).complete(
      request({
        turns: [
          { role: "user", content: "hello" },
          {
            role: "assistant",
            content: "",
            toolCalls: [
              {
                id: "toolu_1",
                name: "list_applications",
                arguments: '{"limit":5}',
              },
            ],
          },
          {
            role: "tool",
            toolCallId: "toolu_1",
            name: "list_applications",
            content: "tool result",
          },
        ],
      }),
    );

    expect(result.text).toBe("First line\nSecond line");
    expect(result.toolCalls).toEqual([
      {
        id: "toolu_1",
        name: "list_applications",
        arguments: '{"limit":5}',
      },
    ]);
    expect(result.usage).toEqual({
      promptTokens: 21,
      completionTokens: 9,
      totalTokens: 30,
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    const body = JSON.parse(String(init.body)) as {
      messages: Array<{ role: string; content: unknown }>;
      tools: Array<{ input_schema: unknown }>;
    };
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(headers["x-api-key"]).toBe("sk-test-key");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(body.messages[1]).toMatchObject({ role: "assistant" });
    expect(body.messages[2]).toEqual({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: "toolu_1",
          content: "tool result",
        },
      ],
    });
    expect(body.tools).toEqual([]);
  });

  it("rejects an Anthropic response with no usable content", async () => {
    fetchMock.mockResolvedValue(Response.json({ content: [] }));

    await expect(
      createAdvisorProvider(
        config({ provider: "anthropic", baseUrl: "https://api.anthropic.com" }),
      ).complete(request()),
    ).rejects.toMatchObject({ code: "provider_invalid_response" });
  });

  it("normalizes text blocks and retry headers", () => {
    expect(
      textValue([
        "a",
        { type: "text", text: "b" },
        { type: "text", text: 5 },
        null,
      ]),
    ).toBe("ab");
    expect(parseRetryAfter("9")).toBe(9);
    expect(parseRetryAfter("bogus")).toBeUndefined();

    const error = providerHttpError(
      new Response(null, { status: 429, headers: { "retry-after": "3" } }),
      "Test provider",
    );
    expect(error).toBeInstanceOf(AdvisorProviderError);
    expect(error.code).toBe("provider_rate_limit");
    expect(error.retryAfterSeconds).toBe(3);
  });
});
