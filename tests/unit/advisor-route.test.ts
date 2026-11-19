import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getWorkspaceStatus: vi.fn(),
  assertSameOrigin: vi.fn(),
  handleAdvisorChat: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/auth/dal", () => ({
  getWorkspaceStatus: mocks.getWorkspaceStatus,
}));
vi.mock("@/lib/http/request", () => ({
  assertSameOrigin: mocks.assertSameOrigin,
}));
vi.mock("@/lib/advisor/chat", () => ({
  handleAdvisorChat: mocks.handleAdvisorChat,
}));
vi.mock("@/lib/observability/logger", () => ({
  logError: mocks.logError,
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

import { POST } from "@/app/api/advisor/chat/route";
import { AdvisorError } from "@/lib/advisor/errors";
import type { AdvisorChatResponse } from "@/lib/advisor/types";

const success: AdvisorChatResponse = {
  conversationId: "conv_123",
  title: "What should I do next?",
  message: {
    id: "msg_1",
    role: "ASSISTANT",
    content: "Start with your documents.",
    model: "gpt-4.1-mini",
    citations: [],
    feedback: null,
    createdAt: "2026-11-17T12:00:00.000Z",
  },
  usage: {
    promptTokens: 10,
    completionTokens: 5,
    totalTokens: 15,
    estimatedCostMicros: 12,
  },
};

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost:3000/api/advisor/chat", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe("advisor chat route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertSameOrigin.mockResolvedValue(undefined);
    mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getWorkspaceStatus.mockResolvedValue({ canUseWorkspace: true });
    mocks.handleAdvisorChat.mockResolvedValue(success);
  });

  it("returns 403 for a cross-origin request before reading the body", async () => {
    mocks.assertSameOrigin.mockRejectedValueOnce(new Error("Cross-origin"));

    const response = await POST(post({ message: "hello" }));

    expect(response.status).toBe(403);
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect((await json(response)).error).toMatchObject({
      code: "unauthorized",
    });
  });

  it("requires an authenticated, unlocked workspace", async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    const anonymous = await POST(post({ message: "hello" }));
    expect(anonymous.status).toBe(401);

    mocks.getWorkspaceStatus.mockResolvedValueOnce({
      canUseWorkspace: false,
    });
    const gated = await POST(post({ message: "hello" }));
    expect(gated.status).toBe(403);
    expect((await json(gated)).error).toMatchObject({ code: "blocked" });
    expect(mocks.handleAdvisorChat).not.toHaveBeenCalled();
  });

  it("rejects malformed and oversized bodies before calling the service", async () => {
    const malformed = new Request("http://localhost:3000/api/advisor/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    });
    expect((await POST(malformed)).status).toBe(400);

    const oversized = new Request("http://localhost:3000/api/advisor/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": "40000",
      },
      body: "{}",
    });
    expect((await POST(oversized)).status).toBe(400);
    expect(mocks.handleAdvisorChat).not.toHaveBeenCalled();
  });

  it("passes only validated fields to the orchestrator and returns no-store JSON", async () => {
    const response = await POST(
      post({ conversationId: "conv_123", message: "  hello  " }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.handleAdvisorChat).toHaveBeenCalledWith("user-1", {
      conversationId: "conv_123",
      message: "hello",
      regenerate: false,
    });
    await expect(response.json()).resolves.toEqual(success);
  });

  it("maps AdvisorError fields, conversation recovery, and Retry-After", async () => {
    mocks.handleAdvisorChat.mockRejectedValueOnce(
      new AdvisorError("rate_limited", "Slow down.", 17, "conv_123"),
    );

    const response = await POST(post({ message: "hello" }));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("17");
    expect((await json(response)).error).toEqual({
      code: "rate_limited",
      message: "Slow down.",
      retryAfterSeconds: 17,
      conversationId: "conv_123",
    });
  });

  it("returns a generic 503 and logs unexpected failures", async () => {
    mocks.handleAdvisorChat.mockRejectedValueOnce(
      new Error("provider secret detail sk-123"),
    );

    const response = await POST(post({ message: "hello" }));
    const body = await json(response);

    expect(response.status).toBe(503);
    expect(body.error).toMatchObject({ code: "provider_unavailable" });
    expect(JSON.stringify(body)).not.toContain("sk-123");
    expect(mocks.logError).toHaveBeenCalledWith(
      "advisor.route_failed",
      expect.any(Error),
      { route: "/api/advisor/chat" },
    );
  });
});
