import { afterEach, describe, expect, it, vi } from "vitest";

import {
  estimateCostMicros,
  getAdvisorConfig,
  getAdvisorStatus,
} from "@/lib/advisor/config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("advisor configuration", () => {
  it("uses safe defaults and keeps the key server-side", () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("AI_API_KEY", "sk-test-key");
    vi.stubEnv("AI_MODEL", "gpt-4.1-mini");

    const config = getAdvisorConfig();

    expect(config.enabled).toBe(true);
    expect(config.provider).toBe("openai");
    expect(config.model).toBe("gpt-4.1-mini");
    expect(config.apiKey).toBe("sk-test-key");
    expect(config.baseUrl).toBe("https://api.openai.com/v1");
    expect(config.timeoutMs).toBe(30_000);
    expect(config.maxOutputTokens).toBe(1_200);
    expect(config.messagesPerMinute).toBe(8);
  });

  it("reports a missing key without exposing provider details", () => {
    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("AI_API_KEY", "");
    vi.stubEnv("AI_MODEL", "gpt-4.1-mini");

    expect(getAdvisorStatus()).toEqual({
      enabled: false,
      provider: "openai",
      model: "gpt-4.1-mini",
      reason: "missing_key",
    });
    expect(JSON.stringify(getAdvisorStatus())).not.toContain("sk-");
  });

  it("rejects unsupported providers and malformed models", () => {
    vi.stubEnv("AI_PROVIDER", "unknown-provider");
    expect(() => getAdvisorConfig()).toThrow(/AI_PROVIDER/);

    vi.stubEnv("AI_PROVIDER", "openai");
    vi.stubEnv("AI_MODEL", "model with spaces");
    expect(() => getAdvisorConfig()).toThrow(/AI_MODEL/);
  });

  it("requires an HTTPS base URL for remote compatible endpoints", () => {
    vi.stubEnv("AI_PROVIDER", "compatible");
    vi.stubEnv("AI_API_KEY", "test");
    vi.stubEnv("AI_BASE_URL", "http://llm.example.test/v1");

    expect(() => getAdvisorConfig()).toThrow(/HTTPS/);

    vi.stubEnv("AI_BASE_URL", "http://127.0.0.1:1234/v1");
    expect(getAdvisorConfig().baseUrl).toBe("http://127.0.0.1:1234/v1");
  });

  it("computes micro-USD cost estimates", () => {
    const cost = estimateCostMicros(
      { inputPerMillion: 0.4, outputPerMillion: 1.6 },
      4_000,
      600,
    );
    expect(cost).toBe(2_560);
  });
});
