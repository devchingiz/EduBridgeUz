import { describe, expect, it } from "vitest";

import {
  advisorFeedbackSchema,
  advisorIdSchema,
  parseAdvisorChatRequest,
} from "@/lib/advisor/validation";

describe("advisor request validation", () => {
  it("accepts a normal message", () => {
    expect(
      parseAdvisorChatRequest({ message: "What should I do next?" }, 4000),
    ).toEqual({
      message: "What should I do next?",
      regenerate: false,
    });
  });

  it("accepts a conversation reference and regenerate flag", () => {
    expect(
      parseAdvisorChatRequest(
        { conversationId: "conv_123", message: "old prompt", regenerate: true },
        4000,
      ),
    ).toEqual({
      conversationId: "conv_123",
      message: "old prompt",
      regenerate: true,
    });
  });

  it("rejects empty, oversized, and control-character messages", () => {
    expect(() => parseAdvisorChatRequest({ message: "   " }, 4000)).toThrow();
    expect(() =>
      parseAdvisorChatRequest({ message: "x".repeat(4001) }, 4000),
    ).toThrow();
    expect(() =>
      parseAdvisorChatRequest({ message: "hello\u0000world" }, 4000),
    ).toThrow();
  });

  it("rejects unknown fields and malformed identifiers", () => {
    expect(() =>
      parseAdvisorChatRequest({ message: "hello", model: "gpt-4.1" }, 4000),
    ).toThrow();
    expect(advisorIdSchema.safeParse("bad id!").success).toBe(false);
    expect(advisorFeedbackSchema.safeParse("MAYBE").success).toBe(false);
  });
});
